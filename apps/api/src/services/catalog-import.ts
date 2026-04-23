import { z } from 'zod';
import Papa from 'papaparse';
import { prisma } from '../lib/prisma.js';
import { getVisionModel, getTextModel, VISION_MOCK_MODE } from '../lib/gemini.js';
import {
  buildMenuExtractionPrompt,
  buildCatalogDescriptionPrompt,
} from '../lib/prompts.js';
import { ServiceUnavailableError, ValidationError } from '../lib/errors.js';

const VALID_CATALOG_TYPES = ['DRIP', 'ADD_ON', 'INJECTION', 'PEPTIDE'] as const;

// ---------------------------------------------------------------------------
// CSV Preview
// ---------------------------------------------------------------------------

export interface CsvPreviewRow {
  name: string;
  type: string;
  description?: string;
  ingredients: string[];
  price?: number;
  valid: boolean;
  errors: string[];
}

export interface CsvPreviewResult {
  rows: CsvPreviewRow[];
  detectedHeaders: string[];
  columnMapping: Record<string, string>;
  totalRows: number;
  validRows: number;
}

const REVERSE_COLUMN_MAP: Record<string, string[]> = {
  name: ['name', 'item name', 'product name', 'title', 'service'],
  type: ['type', 'category', 'item type', 'service type'],
  description: ['description', 'desc', 'notes', 'details'],
  ingredients: ['ingredients', 'ingredient', 'contents', 'components', 'formula'],
  price: ['price', 'cost', 'amount', 'rate'],
};

function inferColumnMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const used = new Set<string>();

  for (const [target, aliases] of Object.entries(REVERSE_COLUMN_MAP)) {
    for (const header of headers) {
      const lowerHeader = header.toLowerCase().trim();
      if (used.has(header)) continue;
      if (aliases.includes(lowerHeader)) {
        mapping[target] = header;
        used.add(header);
        break;
      }
    }
  }

  return mapping;
}

function normalizeIngredients(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((v) => String(v).trim())
      .filter((v) => v.length > 0);
  }
  if (typeof value === 'string') {
    return value
      .split(/[,;|]/)
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
  }
  return [];
}

function validateRow(
  row: Record<string, unknown>,
  columnMapping: Record<string, string>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const nameKey = columnMapping.name || 'name';
  const typeKey = columnMapping.type || 'type';

  const name = String(row[nameKey] || '').trim();
  if (!name) {
    errors.push('Name is required');
  }

  const type = String(row[typeKey] || '').trim().toUpperCase();
  if (!type) {
    errors.push('Type is required');
  } else if (!VALID_CATALOG_TYPES.includes(type as (typeof VALID_CATALOG_TYPES)[number])) {
    errors.push(
      `Invalid type "${type}". Must be one of: ${VALID_CATALOG_TYPES.join(', ')}`
    );
  }

  return { valid: errors.length === 0, errors };
}

function buildPreviewRow(
  row: Record<string, unknown>,
  columnMapping: Record<string, string>
): CsvPreviewRow {
  const validation = validateRow(row, columnMapping);

  const nameKey = columnMapping.name || 'name';
  const typeKey = columnMapping.type || 'type';
  const descKey = columnMapping.description || 'description';
  const ingKey = columnMapping.ingredients || 'ingredients';
  const priceKey = columnMapping.price || 'price';

  const rawPrice = row[priceKey];
  let price: number | undefined;
  if (rawPrice !== undefined && rawPrice !== null && rawPrice !== '') {
    const parsed = Number(rawPrice);
    if (!Number.isNaN(parsed)) {
      price = parsed;
    }
  }

  return {
    name: String(row[nameKey] || '').trim(),
    type: String(row[typeKey] || '').trim().toUpperCase(),
    description: row[descKey] ? String(row[descKey]).trim() : undefined,
    ingredients: normalizeIngredients(row[ingKey]),
    price,
    valid: validation.valid,
    errors: validation.errors,
  };
}

export function parseCsvPreview(
  buffer: Buffer,
  columnMapping?: Record<string, string>
): CsvPreviewResult {
  const csvText = buffer.toString('utf-8');

  const parseResult = Papa.parse<Record<string, unknown>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim().toLowerCase(),
  });

  if (parseResult.errors.length > 0 && parseResult.errors.some((e) => e.type === 'Delimiter')) {
    throw new ValidationError([
      { message: `CSV parse error: ${parseResult.errors[0].message}` },
    ]);
  }

  const detectedHeaders = parseResult.meta.fields || [];
  const mapping = columnMapping || inferColumnMapping(detectedHeaders);

  const rows = parseResult.data.map((row) => buildPreviewRow(row, mapping));

  return {
    rows,
    detectedHeaders,
    columnMapping: mapping,
    totalRows: rows.length,
    validRows: rows.filter((r) => r.valid).length,
  };
}

// ---------------------------------------------------------------------------
// Import execution
// ---------------------------------------------------------------------------

export interface ImportItem {
  name: string;
  type: string;
  description?: string;
  ingredients: string[];
  price?: number;
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
  items: Array<{ id: string; name: string; action: 'created' | 'updated' | 'skipped' }>;
}

export async function importCatalogItems(params: {
  tenantId: string;
  items: ImportItem[];
  duplicateAction: 'UPDATE' | 'SKIP';
}): Promise<ImportResult> {
  const { tenantId, items, duplicateAction } = params;

  const result: ImportResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    items: [],
  };

  const existingItems = await prisma.catalogItem.findMany({
    where: { tenantId, isActive: true },
    select: { id: true, name: true },
  });

  const existingByName = new Map(existingItems.map((i) => [i.name.toLowerCase(), i]));

  for (const item of items) {
    const normalizedName = item.name.trim();
    const normalizedType = item.type.trim().toUpperCase();

    if (!normalizedName || !VALID_CATALOG_TYPES.includes(normalizedType as (typeof VALID_CATALOG_TYPES)[number])) {
      result.failed += 1;
      result.errors.push(`Invalid item: ${normalizedName || '(unnamed)'}`);
      continue;
    }

    const existing = existingByName.get(normalizedName.toLowerCase());

    try {
      if (existing) {
        if (duplicateAction === 'SKIP') {
          result.skipped += 1;
          result.items.push({ id: existing.id, name: normalizedName, action: 'skipped' });
          continue;
        }

        // Update existing
        const updated = await prisma.catalogItem.update({
          where: { id: existing.id },
          data: {
            name: normalizedName,
            type: normalizedType as 'DRIP' | 'ADD_ON' | 'INJECTION' | 'PEPTIDE',
            description: item.description,
            isActive: true,
          },
        });

        await syncIngredients(updated.id, item.ingredients);

        result.updated += 1;
        result.items.push({ id: updated.id, name: normalizedName, action: 'updated' });
      } else {
        // Create new
        const created = await prisma.catalogItem.create({
          data: {
            tenantId,
            name: normalizedName,
            type: normalizedType as 'DRIP' | 'ADD_ON' | 'INJECTION' | 'PEPTIDE',
            description: item.description,
            isActive: true,
            isInStock: true,
          },
        });

        await syncIngredients(created.id, item.ingredients);

        result.created += 1;
        result.items.push({ id: created.id, name: normalizedName, action: 'created' });
      }
    } catch (err) {
      result.failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(`Failed to import "${normalizedName}": ${message}`);
    }
  }

  return result;
}

async function syncIngredients(
  catalogItemId: string,
  ingredientNames: string[]
): Promise<void> {
  if (ingredientNames.length === 0) return;

  // Find or create ingredients
  const ingredientIds: string[] = [];

  for (const name of ingredientNames) {
    const normalized = name.trim();
    if (!normalized) continue;

    let ingredient = await prisma.ingredient.findUnique({
      where: { name: normalized },
    });

    if (!ingredient) {
      ingredient = await prisma.ingredient.create({
        data: { name: normalized },
      });
    }

    ingredientIds.push(ingredient.id);
  }

  // Remove existing links that are not in the new list
  const existingLinks = await prisma.catalogItemIngredient.findMany({
    where: { catalogItemId },
    select: { id: true, ingredientId: true },
  });

  const existingIngredientIds = new Set(existingLinks.map((l) => l.ingredientId));
  const newIngredientIds = new Set(ingredientIds);

  // Delete removed
  for (const link of existingLinks) {
    if (!newIngredientIds.has(link.ingredientId)) {
      await prisma.catalogItemIngredient.delete({ where: { id: link.id } });
    }
  }

  // Add new
  for (const ingredientId of ingredientIds) {
    if (!existingIngredientIds.has(ingredientId)) {
      await prisma.catalogItemIngredient.create({
        data: { catalogItemId, ingredientId },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Menu extraction from image
// ---------------------------------------------------------------------------

export interface ExtractedMenuItem {
  name: string;
  type: string;
  description?: string;
  ingredients: string[];
}

const extractedMenuItemSchema = z.object({
  name: z.string().min(1),
  type: z.enum(VALID_CATALOG_TYPES),
  description: z.string().optional(),
  ingredients: z.array(z.string()).default([]),
});

const geminiMenuResponseSchema = z.object({
  items: z.array(extractedMenuItemSchema),
});

export async function extractMenuFromImage(
  buffer: Buffer,
  mimeType: string
): Promise<ExtractedMenuItem[]> {
  if (VISION_MOCK_MODE) {
    return generateMockMenuItems();
  }

  const base64Data = buffer.toString('base64');
  const prompt = buildMenuExtractionPrompt();

  let rawText: string;

  try {
    const model = getVisionModel();
    const result = await model.generateContent([
      { text: prompt },
      {
        inlineData: {
          mimeType,
          data: base64Data,
        },
      },
    ]);
    rawText = result.response.text();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ServiceUnavailableError(`Gemini menu extraction failed: ${message}`);
  }

  return parseAndValidateMenuItems(rawText);
}

function parseAndValidateMenuItems(rawText: string): ExtractedMenuItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new ServiceUnavailableError('Gemini returned malformed JSON for menu extraction');
  }

  const validation = geminiMenuResponseSchema.safeParse(parsed);
  if (!validation.success) {
    throw new ServiceUnavailableError('Gemini menu response does not match expected schema');
  }

  return validation.data.items.map((item) => ({
    name: item.name.trim(),
    type: item.type,
    description: item.description?.trim(),
    ingredients: item.ingredients.map((i) => i.trim()).filter((i) => i.length > 0),
  }));
}

function generateMockMenuItems(): ExtractedMenuItem[] {
  return [
    {
      name: "Myers' Cocktail",
      type: 'DRIP',
      description: 'Classic blend of vitamins and minerals for energy and immunity.',
      ingredients: ['B-complex', 'Vitamin C', 'Magnesium'],
    },
    {
      name: 'Immunity Boost',
      type: 'DRIP',
      description: 'High-dose Vitamin C and Zinc for immune support.',
      ingredients: ['Vitamin C', 'Zinc', 'Glutathione'],
    },
    {
      name: 'B12 Shot',
      type: 'INJECTION',
      description: 'Quick energy boost with methylcobalamin B12.',
      ingredients: ['Methylcobalamin B12'],
    },
  ];
}

// ---------------------------------------------------------------------------
// AI Description generation
// ---------------------------------------------------------------------------

export async function generateCatalogDescription(params: {
  name: string;
  ingredients: string[];
  type: string;
}): Promise<string> {
  if (VISION_MOCK_MODE) {
    return generateMockDescription(params);
  }

  const prompt = buildCatalogDescriptionPrompt(params);

  let rawText: string;

  try {
    const model = getTextModel();
    const result = await model.generateContent([{ text: prompt }]);
    rawText = result.response.text();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ServiceUnavailableError(`Gemini description generation failed: ${message}`);
  }

  return parseAndValidateDescription(rawText);
}

const descriptionResponseSchema = z.object({
  description: z.string().min(1),
});

function parseAndValidateDescription(rawText: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new ServiceUnavailableError('Gemini returned malformed JSON for description generation');
  }

  const validation = descriptionResponseSchema.safeParse(parsed);
  if (!validation.success) {
    throw new ServiceUnavailableError('Gemini description response does not match expected schema');
  }

  return validation.data.description.trim();
}

function generateMockDescription(params: {
  name: string;
  ingredients: string[];
  type: string;
}): string {
  const ingredientsText =
    params.ingredients.length > 0 ? params.ingredients.join(', ') : 'specialized nutrients';
  return `Key ingredients: ${ingredientsText}. Supports overall wellness and targeted health goals. Recommend for patients seeking ${params.type.toLowerCase()} therapy benefits.`;
}
