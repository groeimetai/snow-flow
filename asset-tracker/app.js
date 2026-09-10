const seedAssets = [
  { id: 1, name: "MacBook Pro 14-inch", tag: "AST-0248", category: "Hardware", assigned: "Olivia Martin", initials: "OM", location: "New York", status: "In use", value: 2499 },
  { id: 2, name: "Dell UltraSharp Monitor", tag: "AST-0247", category: "Hardware", assigned: "Noah Williams", initials: "NW", location: "Austin", status: "In use", value: 649 },
  { id: 3, name: "Figma Professional", tag: "LIC-0093", category: "Software", assigned: "Product team", initials: "PT", location: "Remote", status: "In use", value: 1440 },
  { id: 4, name: "Herman Miller Aeron", tag: "AST-0246", category: "Furniture", assigned: "Unassigned", initials: "--", location: "New York", status: "In stock", value: 1895 },
  { id: 5, name: "Lenovo ThinkPad X1", tag: "AST-0245", category: "Hardware", assigned: "Mia Thompson", initials: "MT", location: "London", status: "In repair", value: 1749 },
  { id: 6, name: "Adobe Creative Cloud", tag: "LIC-0092", category: "Software", assigned: "Design team", initials: "DT", location: "Remote", status: "Retired", value: 780 },
];

const storedAssets = localStorage.getItem("assetly-assets");
const demoAssets = Array.from({ length: 242 }, (_, index) => {
  const status = index < 183 ? "In use" : index < 220 ? "In stock" : index < 231 ? "In repair" : "Retired";
  const assigned = status === "In use" ? `Team member ${index + 1}` : "Unassigned";
  return { id: index + 7, name: `ThinkPad inventory unit ${String(index + 1).padStart(3, "0")}`, tag: `AST-${String(index + 249).padStart(4, "0")}`, category: "Hardware", assigned, initials: initialsFor(assigned), location: index % 3 === 0 ? "New York" : index % 3 === 1 ? "Austin" : "London", status, value: 2790 };
});
let assets = storedAssets ? JSON.parse(storedAssets) : [...seedAssets, ...demoAssets];
let visibleAssets = assets;

const tableBody = document.querySelector("#assetTableBody");
const searchInput = document.querySelector("#searchInput");
const statusFilter = document.querySelector("#statusFilter");
const categoryFilter = document.querySelector("#categoryFilter");
const filterBar = document.querySelector("#filterBar");
const modal = document.querySelector("#assetModal");
const toast = document.querySelector("#toast");

function saveAssets() {
  localStorage.setItem("assetly-assets", JSON.stringify(assets));
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function initialsFor(name) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "--";
}

function statusClass(status) {
  return `status-${status.toLowerCase().replace(" ", "-")}`;
}

function renderTable() {
  visibleAssets = assets.filter((asset) => {
    const query = searchInput.value.trim().toLowerCase();
    const matchesQuery = !query || [asset.name, asset.tag, asset.assigned, asset.location].join(" ").toLowerCase().includes(query);
    const matchesStatus = statusFilter.value === "all" || asset.status === statusFilter.value;
    const matchesCategory = categoryFilter.value === "all" || asset.category === categoryFilter.value;
    return matchesQuery && matchesStatus && matchesCategory;
  });
  tableBody.innerHTML = visibleAssets.slice(0, 6).map((asset) => `
    <tr data-id="${asset.id}">
      <td><input type="checkbox" aria-label="Select ${asset.name}" /></td>
      <td><div class="asset-cell"><div class="asset-thumb">${asset.category === "Software" ? "S" : asset.category === "Furniture" ? "F" : "H"}</div><div><strong>${asset.name}</strong><span>${asset.tag}</span></div></div></td>
      <td>${asset.category}</td>
      <td><div class="assigned-cell"><span class="mini-avatar">${asset.initials}</span><span>${asset.assigned}</span></div></td>
      <td>${asset.location}</td>
      <td><span class="status-pill ${statusClass(asset.status)}">${asset.status}</span></td>
      <td>${formatCurrency(asset.value)}</td>
      <td><button class="row-menu" type="button" aria-label="Retire ${asset.name}" data-action="retire">...</button></td>
    </tr>
  `).join("");
  document.querySelector("#emptyState").classList.toggle("hidden", visibleAssets.length > 0);
  document.querySelector("#assetResultCount").textContent = visibleAssets.length;
  document.querySelector("#tableSummary").textContent = `Showing ${visibleAssets.length ? 1 : 0}-${Math.min(6, visibleAssets.length)} of ${visibleAssets.length}`;
  document.querySelector("#filterCount").textContent = [statusFilter.value !== "all", categoryFilter.value !== "all"].filter(Boolean).length || "";
  updateMetrics();
}

function updateMetrics() {
  const total = assets.length;
  const inUse = assets.filter((asset) => asset.status === "In use").length;
  const inStock = assets.filter((asset) => asset.status === "In stock").length;
  const inRepair = assets.filter((asset) => asset.status === "In repair").length;
  const retired = assets.filter((asset) => asset.status === "Retired").length;
  const totalValue = assets.reduce((sum, asset) => sum + Number(asset.value || 0), 0);
  document.querySelector("#totalAssets").textContent = total;
  document.querySelector("#assignedAssets").textContent = inUse;
  document.querySelector("#portfolioValue").textContent = formatCurrency(totalValue);
  document.querySelector("#attentionAssets").textContent = inRepair + 3;
  document.querySelector(".donut-center strong").textContent = total;
  document.querySelector("#inUseCount").textContent = inUse;
  document.querySelector("#inStockCount").textContent = inStock;
  document.querySelector("#inRepairCount").textContent = inRepair;
  document.querySelector("#retiredCount").textContent = retired;
  document.querySelector(".nav-count").textContent = total;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove("hidden");
  window.setTimeout(() => toast.classList.add("hidden"), 2800);
}

function closeModal() {
  modal.classList.add("hidden");
}

document.querySelector("#addAssetButton").addEventListener("click", () => modal.classList.remove("hidden"));
document.querySelector("#closeModal").addEventListener("click", closeModal);
document.querySelector("#cancelModal").addEventListener("click", closeModal);
modal.addEventListener("click", (event) => { if (event.target === modal) closeModal(); });
[searchInput, statusFilter, categoryFilter].forEach((control) => control.addEventListener("input", renderTable));
document.querySelector("#filterButton").addEventListener("click", () => filterBar.classList.toggle("hidden"));
document.querySelector("#clearFilters").addEventListener("click", () => { statusFilter.value = "all"; categoryFilter.value = "all"; renderTable(); });
document.querySelector("#assetForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.target);
  const assigned = form.get("assigned") || "Unassigned";
  assets = [{ id: Date.now(), name: form.get("name"), tag: form.get("tag"), category: form.get("category"), assigned, initials: initialsFor(assigned), location: form.get("location") || "Unassigned", status: form.get("status"), value: Number(form.get("value")) || 0 }, ...assets];
  saveAssets();
  renderTable();
  event.target.reset();
  closeModal();
  showToast("Asset added to your inventory");
});
tableBody.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action='retire']");
  if (!button) return;
  const asset = assets.find((item) => item.id === Number(button.closest("tr").dataset.id));
  if (!asset) return;
  asset.status = asset.status === "Retired" ? "In stock" : "Retired";
  saveAssets();
  renderTable();
  showToast(`${asset.name} marked as ${asset.status.toLowerCase()}`);
});
document.querySelector("#exportButton").addEventListener("click", () => {
  const csv = ["Name,Tag,Category,Assigned to,Location,Status,Value", ...assets.map((asset) => [asset.name, asset.tag, asset.category, asset.assigned, asset.location, asset.status, asset.value].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))].join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  link.download = "assetly-inventory.csv";
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("Inventory export downloaded");
});
document.querySelector("#selectAll").addEventListener("change", (event) => document.querySelectorAll("#assetTableBody input[type='checkbox']").forEach((checkbox) => { checkbox.checked = event.target.checked; }));

renderTable();
