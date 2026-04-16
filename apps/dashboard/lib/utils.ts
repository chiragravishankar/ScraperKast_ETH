/** Concatenate class names (tiny cn helper — no clsx dep needed). */
export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
