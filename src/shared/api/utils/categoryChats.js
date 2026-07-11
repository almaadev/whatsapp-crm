import ProductMessage from "@/shared/models/ProductMessage";
import MDCampMessage from "@/shared/models/MDCampMessage";
import TherapyMessage from "@/shared/models/TherapyMessage";
import { getCategoryConfig, isValidCategorySlug } from "@/shared/constants/categories";

const MODEL_BY_SLUG = {
  product: ProductMessage,
  mdcamp: MDCampMessage,
  therapy: TherapyMessage,
};

export function resolveCategoryChat(slug) {
  if (!isValidCategorySlug(slug)) return null;

  const config = getCategoryConfig(slug);
  return {
    ...config,
    Model: MODEL_BY_SLUG[slug],
  };
}
