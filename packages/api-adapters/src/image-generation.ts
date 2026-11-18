/**
 * CircuitSoul Blog — Hero Image Generation Provider Abstraction
 *
 * Provides a provider abstraction for hero image generation so the
 * application can switch between image generation services without
 * rewriting callers. Each provider must implement:
 *   generateImage(prompt): Promise<ImageResult>
 *
 * If no provider is configured, a safe fallback returns null and the
 * application can use a default placeholder image.
 */

export interface ImageGenerationInput {
  prompt: string;
  width?: number;
  height?: number;
}

export interface ImageResult {
  url: string;
  provider: string;
  model?: string;
}

export interface ImageProvider {
  readonly name: string;
  generateImage(input: ImageGenerationInput): Promise<ImageResult | null>;
}

/**
 * NullImageProvider
 *
 * Safe fallback that returns null. The application should use a default
 * placeholder image when no image provider is configured.
 */
export class NullImageProvider implements ImageProvider {
  readonly name = 'none';

  async generateImage(): Promise<ImageResult | null> {
    return null;
  }
}

/**
 * PlaceholderImageProvider
 *
 * Generates a placeholder image URL using a placeholder service.
 * Used as a fallback when no real image generator is configured.
 */
export class PlaceholderImageProvider implements ImageProvider {
  readonly name = 'placeholder';

  async generateImage(input: ImageGenerationInput): Promise<ImageResult | null> {
    const encodedPrompt = encodeURIComponent(input.prompt);
    const width = input.width ?? 1200;
    const height = input.height ?? 630;
    return {
      url: `https://placehold.co/${width}x${height}?text=${encodedPrompt}`,
      provider: 'placeholder',
      model: 'placeholder'
    };
  }
}

export function createDefaultImageProvider(): ImageProvider {
  const providerName = process.env.BLOG_IMAGE_PROVIDER || 'placeholder';
  switch (providerName) {
    case 'none':
      return new NullImageProvider();
    case 'placeholder':
    default:
      return new PlaceholderImageProvider();
  }
}
