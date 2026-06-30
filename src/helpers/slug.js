const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start of text
    .replace(/-+$/, '');            // Trim - from end of text
};

const generateUniqueSlug = async (baseSlug, model, id = null) => {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await model
      .select('id')
      .eq('slug', slug)
      .neq('id', id || '00000000-0000-0000-0000-000000000000')
      .maybeSingle();

    if (!existing) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;

    if (counter > 1000) {
      slug = `${baseSlug}-${Date.now()}`;
      return slug;
    }
  }
};

module.exports = { slugify, generateUniqueSlug };
