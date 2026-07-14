import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useApi } from '@/hooks/useApi';
import { ApiError } from '@/api/client';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useApi', () => {
  it('calls the fetcher once on mount and stays loading until it resolves', async () => {
    const { promise, resolve } = deferred<{ id: number }>();
    const fetcher = jest.fn().mockReturnValue(promise);

    const { result } = await renderHook(() => useApi(fetcher));

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();

    await act(async () => {
      resolve({ id: 1 });
      await promise;
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual({ id: 1 });
  });

  it('exposes an ApiError message on failure', async () => {
    const fetcher = jest.fn().mockRejectedValue(new ApiError('Not found', 404));
    const { result } = await renderHook(() => useApi(fetcher));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Not found');
    expect(result.current.data).toBeNull();
  });

  it('falls back to a generic message for non-ApiError failures', async () => {
    const fetcher = jest.fn().mockRejectedValue(new Error('boom'));
    const { result } = await renderHook(() => useApi(fetcher));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Something went wrong.');
  });

  it('refresh() uses refreshing instead of loading, and updates data on success', async () => {
    const fetcher = jest.fn().mockResolvedValue({ id: 1 });
    const { result } = await renderHook(() => useApi(fetcher));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const { promise, resolve } = deferred<{ id: number }>();
    fetcher.mockReturnValueOnce(promise);

    await act(() => {
      void result.current.refresh();
    });

    expect(result.current.refreshing).toBe(true);
    expect(result.current.loading).toBe(false);

    await act(async () => {
      resolve({ id: 2 });
      await promise;
    });

    expect(result.current.refreshing).toBe(false);
    expect(result.current.data).toEqual({ id: 2 });
  });

  it('reload() clears a previous error and re-fetches', async () => {
    const fetcher = jest
      .fn()
      .mockRejectedValueOnce(new ApiError('Nope', 400))
      .mockResolvedValueOnce({ id: 5 });

    const { result } = await renderHook(() => useApi(fetcher));
    await waitFor(() => expect(result.current.error).toBe('Nope'));

    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual({ id: 5 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('re-fetches when the fetcher identity changes', async () => {
    const fetcherA = jest.fn().mockResolvedValue({ id: 'a' });
    const fetcherB = jest.fn().mockResolvedValue({ id: 'b' });

    const { result, rerender } = await renderHook(
      ({ fetcher }: { fetcher: () => Promise<{ id: string }> }) => useApi(fetcher),
      { initialProps: { fetcher: fetcherA as () => Promise<{ id: string }> } }
    );
    await waitFor(() => expect(result.current.data).toEqual({ id: 'a' }));

    await rerender({ fetcher: fetcherB });
    await waitFor(() => expect(result.current.data).toEqual({ id: 'b' }));

    expect(fetcherA).toHaveBeenCalledTimes(1);
    expect(fetcherB).toHaveBeenCalledTimes(1);
  });

  it('setData applies a direct optimistic update without re-fetching', async () => {
    const fetcher = jest.fn().mockResolvedValue({ id: 1, count: 0 });
    const { result } = await renderHook(() => useApi(fetcher));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => {
      result.current.setData({ id: 1, count: 1 });
    });

    expect(result.current.data).toEqual({ id: 1, count: 1 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
