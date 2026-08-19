/**
 * Centralized registry of all supported CRM Template variables.
 * Exposes metadata, labels, sources, sample preview values, and fallback strategies.
 */
export const CRM_TEMPLATE_VARIABLES = {
  name: {
    key: "name",
    label: "Customer Name",
    description: "Full name of the customer",
    source: "customer.name",
    sample: "Padmanaban",
    fallback: "there",
  },
  customerName: {
    key: "customerName",
    label: "Customer Name (Alias)",
    description: "Full name of the customer",
    source: "customer.name",
    sample: "Padmanaban",
    fallback: "there",
  },
  firstName: {
    key: "firstName",
    label: "First Name",
    description: "First name parsed from customer full name",
    source: "customer.firstName",
    sample: "Padmanaban",
    fallback: "there",
  },
  phone: {
    key: "phone",
    label: "Phone Number",
    description: "WhatsApp phone number of the customer",
    source: "customer.phone",
    sample: "+91 98765 43210",
    fallback: "",
  },
  branchName: {
    key: "branchName",
    label: "Branch Name",
    description: "Branch assigned to the customer",
    source: "branch.name",
    sample: "Chennai Main Branch",
    fallback: "",
  },
  associateName: {
    key: "associateName",
    label: "Assigned Associate",
    description: "Name of the associate assigned to this lead/customer",
    source: "customer.assignedTo",
    sample: "Mani",
    fallback: "Team Member",
  },
  leadType: {
    key: "leadType",
    label: "Lead / Route Category",
    description: "Active route category or lead type",
    source: "customer.activeRouteCategory",
    sample: "Direct Lead",
    fallback: "Direct Lead",
  },
  leadStatus: {
    key: "leadStatus",
    label: "Lead Status",
    description: "Current lifecycle status of the lead",
    source: "customer.status",
    sample: "New",
    fallback: "Active",
  },
  remarks: {
    key: "remarks",
    label: "Remarks / Notes",
    description: "Latest remarks on customer or lead",
    source: "customer.remarks",
    sample: "Interested in herbal products",
    fallback: "",
  },
  city: {
    key: "city",
    label: "City",
    description: "City from customer address",
    source: "customerAddress.city",
    sample: "Chennai",
    fallback: "",
  },
};

/**
 * Returns a list of variable chips for the template editor UI.
 */
export const AVAILABLE_VARIABLE_LIST = Object.values(CRM_TEMPLATE_VARIABLES).filter(
  (v) => v.key !== "customerName" // Hide duplicate alias from picker list for cleaner UI
);
