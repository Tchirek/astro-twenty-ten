import assert from 'node:assert/strict';
import test from 'node:test';
import rehypeTwentyTen, { type HastNode } from './rehype-twenty-ten.ts';

const element = (tagName: string, properties: Record<string, unknown> = {}, children: HastNode[] = []): HastNode => ({
  type: 'element',
  tagName,
  properties,
  children,
});
const text = (value: string): HastNode => ({ type: 'text', value });

test('rehype transform keeps internal links and annotates text external links', () => {
  const relative = element('a', { href: '../about/' }, [text('About')]);
  const rootRelative = element('a', { href: '/archives/' }, [text('Archives')]);
  const sameOrigin = element('a', { href: 'https://example.com/about/' }, [text('Same site')]);
  const external = element('a', { href: 'https://astro.build/' }, [text('Astro')]);
  const mail = element('a', { href: 'mailto:hello@example.com' }, [text('Email')]);
  const telephone = element('a', { href: 'tel:+123456789' }, [text('Call')]);
  const hash = element('a', { href: '#comments' }, [text('Comments')]);
  const imageExternal = element('a', { href: 'https://images.example/' }, [element('img', { src: '/photo.jpg', alt: 'Photo' })]);
  const tree: HastNode = { type: 'root', children: [relative, rootRelative, sameOrigin, external, mail, telephone, hash, imageExternal] };

  rehypeTwentyTen({ site: 'https://example.com' })(tree);

  for (const link of [relative, rootRelative, sameOrigin, mail, telephone, hash]) {
    assert.equal(link.properties?.target, undefined);
    assert.equal(link.children?.length, 1);
  }
  assert.equal(external.properties?.href, 'https://astro.build/');
  assert.equal(external.properties?.target, '_blank');
  assert.deepEqual(external.properties?.rel, ['external', 'noopener']);
  assert.equal(external.children?.at(-2)?.children?.[0].value, '↗');
  assert.equal(external.children?.at(-1)?.children?.[0].value, ' (opens in a new tab)');
  assert.equal(imageExternal.properties?.target, '_blank');
  assert.equal(imageExternal.children?.length, 1);
});

test('rehype transform emits static heading links, figures, and accessible metadata', () => {
  const heading = element('h2', {}, [text('A useful heading')]);
  const duplicate = element('h2', {}, [text('A useful heading')]);
  const image = element('img', { src: '/photo.jpg', alt: 'Photo', title: 'A caption' });
  const paragraph = element('p', {}, [image]);
  const pre = element('pre', {}, [element('code', { className: ['language-ts'] }, [text('const ok = true;')])]);
  const header = element('th', {}, [text('Name')]);
  const tree: HastNode = { type: 'root', children: [heading, duplicate, paragraph, pre, header] };

  rehypeTwentyTen({ site: 'https://example.com' })(tree);

  assert.equal(heading.properties?.id, 'a-useful-heading');
  assert.equal(duplicate.properties?.id, 'a-useful-heading-1');
  assert.equal(heading.children?.at(-1)?.properties?.href, '#a-useful-heading');
  assert.equal(paragraph.tagName, 'figure');
  assert.equal(paragraph.children?.[1].tagName, 'figcaption');
  assert.equal(image.properties?.loading, 'lazy');
  assert.equal(image.properties?.decoding, 'async');
  assert.equal(pre.properties?.tabIndex, 0);
  assert.equal(pre.properties?.dataLanguage, 'ts');
  assert.equal(header.properties?.scope, 'col');
});
