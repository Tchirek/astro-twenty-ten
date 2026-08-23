export interface SearchSource {
  title: string;
  tags: string[];
  description: string;
  body: string;
  url: string;
  date: string;
}

export interface SearchDocument extends Omit<SearchSource, 'body' | 'tags'> {
  content: string;
}

export interface SearchIndex {
  documents: SearchDocument[];
  postings: Record<string, Array<[document: number, score: number]>>;
}

export interface SearchResult extends SearchDocument {
  score: number;
  snippet: string;
}

const cjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const runs = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+|[\p{Letter}\p{Number}]+/gu;

function normalize(value: string) {
  return value.normalize('NFKD').replace(/\p{Mark}/gu, '').toLocaleLowerCase('en');
}

export function tokenize(value: string) {
  const output: string[] = [];
  for (const run of normalize(value).match(runs) ?? []) {
    if (!cjk.test(run)) {
      output.push(run);
      continue;
    }
    const characters = [...run];
    output.push(...characters);
    for (let index = 0; index < characters.length - 1; index += 1) {
      output.push(characters[index] + characters[index + 1]);
    }
  }
  return output;
}

export function markdownText(markdown: string) {
  return markdown
    .replace(/```[^\n]*\n([\s\S]*?)```/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[`#*_>{}|~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildSearchIndex(sources: SearchSource[]): SearchIndex {
  const documents = sources.map(({ body, tags: _tags, ...source }) => ({ ...source, content: markdownText(body) }));
  const scores = new Map<string, Map<number, number>>();
  const fields = sources.map((source, index) => [
    [source.title, 5],
    [source.tags.join(' '), 3],
    [source.description, 2],
    [documents[index].content, 1],
  ] as Array<[string, number]>);

  fields.forEach((documentFields, document) => {
    for (const [value, weight] of documentFields) {
      const counts = new Map<string, number>();
      tokenize(value).forEach((token) => counts.set(token, (counts.get(token) ?? 0) + 1));
      for (const [token, count] of counts) {
        const posting = scores.get(token) ?? new Map<number, number>();
        posting.set(document, (posting.get(document) ?? 0) + weight * (1 + Math.log(count)));
        scores.set(token, posting);
      }
    }
  });

  return {
    documents,
    postings: Object.fromEntries(
      [...scores].map(([token, posting]) => [token, [...posting].map(([document, score]) => [document, Number(score.toFixed(3))])]),
    ),
  };
}

export function makeSnippet(content: string, query: string, length = 180) {
  if (!content) return '';
  const normalizedContent = normalize(content);
  const normalizedQuery = normalize(query.trim());
  const firstToken = tokenize(query)[0] ?? '';
  const match = normalizedContent.indexOf(normalizedQuery) >= 0
    ? normalizedContent.indexOf(normalizedQuery)
    : normalizedContent.indexOf(firstToken);
  const start = Math.max(0, match - Math.floor(length / 3));
  const excerpt = content.slice(start, start + length).trim();
  return `${start > 0 ? '…' : ''}${excerpt}${start + length < content.length ? '…' : ''}`;
}

export function querySearch(index: SearchIndex, query: string, limit = 20): SearchResult[] {
  const queryTokens = [...new Set(tokenize(query))];
  if (!queryTokens.length) return [];

  const matches = new Map<number, { score: number; hits: number }>();
  for (const token of queryTokens) {
    for (const [document, score] of index.postings[token] ?? []) {
      const match = matches.get(document) ?? { score: 0, hits: 0 };
      match.score += score;
      match.hits += 1;
      matches.set(document, match);
    }
  }

  return [...matches]
    .filter(([, match]) => match.hits === queryTokens.length)
    .sort(([leftDocument, left], [rightDocument, right]) => right.score - left.score || leftDocument - rightDocument)
    .slice(0, limit)
    .map(([document, match]) => ({
      ...index.documents[document],
      score: match.score,
      snippet: makeSnippet(index.documents[document].content, query),
    }));
}
