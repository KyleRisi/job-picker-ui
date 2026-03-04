type MerchBuyNowFormProps = {
  productSlug: string;
  buttonLabel?: string;
  formClassName?: string;
  buttonClassName?: string;
};

export function MerchBuyNowForm({
  productSlug,
  buttonLabel = 'Buy Now',
  formClassName,
  buttonClassName
}: MerchBuyNowFormProps) {
  return (
    <form action="/api/stripe/checkout" method="POST" className={formClassName}>
      <input type="hidden" name="product" value={productSlug} />
      <button
        type="submit"
        className={
          buttonClassName ??
          'inline-flex items-center justify-center rounded-full bg-carnival-red px-8 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg transition hover:brightness-110'
        }
      >
        {buttonLabel}
      </button>
    </form>
  );
}
