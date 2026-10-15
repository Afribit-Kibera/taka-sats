// SPDX-License-Identifier: AGPL-3.0-only
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { publicDocHref } from '@/lib/docs';

/** Server-only composition: committed Markdown, no raw HTML/MDX, no remote images or client parser. */
export function DocsArticle({
  content,
  tableLabel,
  codeLabel,
}: {
  content: string;
  tableLabel: string;
  codeLabel: string;
}) {
  return (
    <article className="min-w-0 space-y-5 break-words text-base leading-8 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_a]:[overflow-wrap:anywhere] [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_code]:font-mono [&_code]:text-sm [&_h1]:mb-7 [&_h1]:font-display [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:leading-tight [&_h2]:!mt-12 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:leading-snug [&_h3]:!mt-8 [&_h3]:font-display [&_h3]:text-xl [&_h3]:font-bold [&_li]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:text-muted-foreground [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border [&_pre]:bg-secondary [&_pre]:p-4 [&_pre]:leading-6 [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:pl-6 sm:[&_h1]:text-4xl">
      <Markdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        disallowedElements={['img']}
        urlTransform={publicDocHref}
        components={{
          pre: ({ children }) => (
            <pre
              tabIndex={0}
              role="region"
              aria-label={codeLabel}
              className="focus-visible:outline-2 focus-visible:outline-ring"
            >
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div
              role="region"
              aria-label={tableLabel}
              tabIndex={0}
              className="max-w-full overflow-x-auto rounded-lg border border-border focus-visible:outline-2 focus-visible:outline-ring"
            >
              <table className="w-full min-w-[36rem] border-collapse text-left text-sm leading-6 [&_td]:border-t [&_td]:border-border [&_td]:p-3 [&_td]:align-top [&_th]:bg-secondary [&_th]:p-3">
                {children}
              </table>
            </div>
          ),
        }}
      >
        {content}
      </Markdown>
    </article>
  );
}
