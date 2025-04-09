import linkifyHtml from 'linkify-html';

export function formatMessage(message: string): string {
  return linkifyHtml(message, {
    defaultProtocol: 'https',
    target: '_blank',
    rel: 'noopener noreferrer',
  });
}
