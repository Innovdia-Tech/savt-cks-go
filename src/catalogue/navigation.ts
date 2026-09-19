/** Keep browser Back/Forward under the existing address-draft authority. */
export function guardHistoryNavigation(
  current: string,
  next: string,
  replace: (route: string) => void,
  guard: (action: () => void) => void,
  accept: (route: string) => void,
) {
  if (current === next) return;
  replace(current);
  guard(() => {
    replace(next);
    accept(next);
  });
}
