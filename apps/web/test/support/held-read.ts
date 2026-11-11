/** A deterministic port read: captures arguments immediately, settles only on demand. */
export function heldRead<A extends unknown[], T>(read: (...args: A) => Promise<T>) {
  const calls: { args: A; resolve: (answer?: T) => Promise<void>; reject: () => void }[] = [];
  const invoke = (...args: A): Promise<T> => new Promise((resolve, reject) => {
    calls.push({
      args,
      resolve: async (answer) => resolve(answer ?? await read(...args)),
      reject: () => reject(new Error("Private exception payload must never render")),
    });
  });
  return { calls, invoke };
}
