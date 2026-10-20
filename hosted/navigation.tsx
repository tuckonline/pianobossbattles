import type { AnchorHTMLAttributes } from "react";
export function navigate(path: string) {
  history.pushState({}, "", path);
  window.dispatchEvent(new Event("piano:navigate"));
  window.scrollTo(0, 0);
}
export function useRouter() {
  return {
    push: navigate,
    replace: (path: string) => {
      history.replaceState({}, "", path);
      window.dispatchEvent(new Event("piano:navigate"));
    },
    refresh: () => window.dispatchEvent(new Event("piano:refresh")),
  };
}
export default function Link({
  href,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return (
    <a
      href={href}
      {...props}
      onClick={(e) => {
        props.onClick?.(e);
        if (
          e.defaultPrevented ||
          e.ctrlKey ||
          e.metaKey ||
          e.shiftKey ||
          e.button !== 0
        )
          return;
        e.preventDefault();
        navigate(href);
      }}
    />
  );
}
