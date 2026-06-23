import ProductMessage from "@/models/ProductMessage";
import MDCampMessage from "@/models/MDCampMessage";
import TherapyMessage from "@/models/TherapyMessage";
import { getCategoryConfig, isValidCategorySlug } from "@/constants/categories";

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
