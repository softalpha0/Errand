import { LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
      <p className="num text-sm text-muted">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">There's nothing at this address.</h1>
      <p className="mt-2 text-muted">If you followed a receipt link, check that it was copied in full.</p>
      <LinkButton href="/" variant="secondary" className="mt-8">
        Go to the home page
      </LinkButton>
    </div>
  );
}
