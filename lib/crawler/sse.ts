export function createSSEResponse() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController;
  let isClosed = false;

  const stream = new ReadableStream({
    start(c) {
      controller = c;
    },
  });

  const sendEvent = (data: object) => {
    if (isClosed) return;
    try {
      const message = `data: ${JSON.stringify(data)}\n\n`;
      controller.enqueue(encoder.encode(message));
    } catch {
      isClosed = true;
    }
  };

  const close = () => {
    if (!isClosed) {
      try {
        controller.close();
        isClosed = true;
      } catch {
        isClosed = true;
      }
    }
  };

  return { stream, sendEvent, close };
}

export function sseHeaders(): Record<string, string> {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  };
}
