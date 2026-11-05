import sanitizeHtml from 'sanitize-html';

export function sanitizeBlogHtml(content: string): string {
  return sanitizeHtml(content, {
    allowedTags: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'p', 'a', 'ul', 'ol',
      'li', 'b', 'strong', 'i', 'em', 'strike', 'del', 'code', 'pre', 'hr', 'br'
    ],
    allowedAttributes: { a: ['href', 'name', 'target', 'rel'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }, true)
    }
  });
}
