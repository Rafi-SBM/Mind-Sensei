/* ==========================================================================
   Web Worker Messaging Utilities
   ========================================================================== */

export interface WorkerMessage<T = unknown> {
    type: string;
    payload: T;
    id: string;
}

export interface WorkerResponse<T = unknown> {
    type: string;
    payload: T;
    id: string;
    error?: string;
}

/** Create a promise-based wrapper for worker messages */
export function createWorkerRequest<TPayload, TResult>(
    worker: Worker,
    type: string,
    payload: TPayload
): Promise<TResult> {
    return new Promise((resolve, reject) => {
        const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

        const handler = (event: MessageEvent<WorkerResponse<TResult>>) => {
            if (event.data.id !== id) return;
            worker.removeEventListener('message', handler);

            if (event.data.error) {
                reject(new Error(event.data.error));
            } else {
                resolve(event.data.payload);
            }
        };

        worker.addEventListener('message', handler);
        const message: WorkerMessage<TPayload> = { type, payload, id };
        worker.postMessage(message);
    });
}

/** Helper for worker-side message handling */
export function handleWorkerMessage<TPayload>(
    event: MessageEvent<WorkerMessage<TPayload>>,
    handlers: Record<string, (payload: TPayload) => unknown>
): void {
    const { type, payload, id } = event.data;
    const handler = handlers[type];

    if (!handler) {
        self.postMessage({ type, id, error: `Unknown message type: ${type}` });
        return;
    }

    try {
        const result = handler(payload);
        self.postMessage({ type, payload: result, id });
    } catch (e) {
        const errorMsg = e instanceof Error ? e.message : 'Unknown error';
        self.postMessage({ type, id, error: errorMsg });
    }
}
