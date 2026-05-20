import { PassThrough } from 'node:stream';
import { createReadableStreamFromReadable } from '@react-router/node';
import { ServerRouter, type EntryContext } from 'react-router';
import { isbot } from 'isbot';
import { renderToPipeableStream } from 'react-dom/server';

const ABORT_DELAY = 5000;

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
) {
  // Bots get the fully buffered HTML; humans get streamed shell-first render.
  const useOnAllReady = isbot(request.headers.get('user-agent') ?? '');

  return new Promise<Response>((resolve, reject) => {
    let didError = false;

    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter context={routerContext} url={request.url} />,
      {
        [useOnAllReady ? 'onAllReady' : 'onShellReady']: () => {
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);
          responseHeaders.set('Content-Type', 'text/html');
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: didError ? 500 : responseStatusCode,
            }),
          );
          pipe(body);
        },
        onShellError: (err: unknown) => reject(err),
        onError: (err: unknown) => {
          didError = true;
          // eslint-disable-next-line no-console
          console.error(err);
        },
      },
    );

    setTimeout(abort, ABORT_DELAY);
  });
}
