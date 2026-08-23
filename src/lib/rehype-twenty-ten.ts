interface HastNode {
  type: string;
  value?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

interface Options {
  site: string;
}

function textContent(node: HastNode): string {
  if (node.type === 'text' || node.type === 'raw') return node.value ?? '';
  return node.children?.map(textContent).join('') ?? '';
}

function tokens(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  return typeof value === 'string' ? value.split(/\s+/).filter(Boolean) : [];
}

function addTokens(node: HastNode, property: string, additions: string[]) {
  const properties = node.properties ??= {};
  properties[property] = [...new Set([...tokens(properties[property]), ...additions])];
}

function contains(node: HastNode, tagName: string): boolean {
  return node.tagName === tagName || Boolean(node.children?.some((child) => contains(child, tagName)));
}

function headingSlug(text: string) {
  return text
    .normalize('NFKD')
    .replace(/\p{Mark}/gu, '')
    .toLocaleLowerCase('en')
    .trim()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '') || 'section';
}

export default function rehypeTwentyTen({ site }: Options) {
  const siteOrigin = new URL(site).origin;

  return (tree: HastNode) => {
    const headingCounts = new Map<string, number>();

    function transform(node: HastNode) {
      if (node.type !== 'element' || !node.tagName) return;
      const properties = node.properties ??= {};

      if (/^h[2-6]$/.test(node.tagName)) {
        const text = textContent(node).trim();
        const base = typeof properties.id === 'string' ? properties.id : headingSlug(text);
        const count = headingCounts.get(base) ?? 0;
        const id = count ? `${base}-${count}` : base;
        headingCounts.set(base, count + 1);
        properties.id = id;
        if (!node.children?.some((child) => tokens(child.properties?.className).includes('heading-link'))) {
          node.children ??= [];
          node.children.push({
            type: 'element',
            tagName: 'a',
            properties: { className: ['heading-link'], href: `#${id}`, ariaLabel: `Permalink to “${text}”` },
            children: [],
          });
        }
      }

      if (node.tagName === 'a' && typeof properties.href === 'string' && /^https?:\/\//i.test(properties.href)) {
        let external = false;
        try {
          external = new URL(properties.href).origin !== siteOrigin;
        } catch {
          return;
        }
        if (external) {
          properties.target = '_blank';
          addTokens(node, 'rel', ['external', 'noopener']);
          addTokens(node, 'className', ['external-link']);
          if (!contains(node, 'img') && !node.children?.some((child) => tokens(child.properties?.className).includes('external-link-mark'))) {
            node.children ??= [];
            node.children.push({
              type: 'element',
              tagName: 'span',
              properties: { className: ['external-link-mark'], ariaHidden: 'true' },
              children: [{ type: 'text', value: '↗' }],
            });
          }
        }
      }

      if (node.tagName === 'img') {
        properties.loading ??= 'lazy';
        properties.decoding ??= 'async';
      }

      if (node.tagName === 'pre') {
        properties.tabIndex ??= 0;
        const code = node.children?.find((child) => child.tagName === 'code');
        const language = tokens(code?.properties?.className).find((name) => name.startsWith('language-'))?.slice(9);
        if (language) properties.dataLanguage ??= language;
      }

      if (node.tagName === 'th') properties.scope ??= 'col';

      if (node.tagName === 'p') {
        const content = node.children?.filter((child) => child.type !== 'text' || child.value?.trim()) ?? [];
        const image = content.length === 1 && content[0].tagName === 'img' ? content[0] : undefined;
        if (image) {
          const title = typeof image.properties?.title === 'string' ? image.properties.title : undefined;
          if (title) delete image.properties!.title;
          node.tagName = 'figure';
          node.properties = { className: ['content-figure'] };
          node.children = [image];
          if (title) {
            node.children.push({
              type: 'element',
              tagName: 'figcaption',
              properties: {},
              children: [{ type: 'text', value: title }],
            });
          }
        }
      }
    }

    function walk(node: HastNode) {
      transform(node);
      node.children?.forEach(walk);
    }

    walk(tree);
  };
}

export type { HastNode };
