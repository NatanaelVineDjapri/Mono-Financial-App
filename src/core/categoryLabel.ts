// A category with its optional sub-category, as one label: "Food & drink › Alone". No sub-category: just the category.
export function categoryWithSub(category: string, subcategory?: string | null): string {
  const sub = subcategory?.trim();
  return sub ? `${category} › ${sub}` : category;
}
