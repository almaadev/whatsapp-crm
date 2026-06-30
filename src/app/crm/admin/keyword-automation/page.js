"use client";
import { useState, useEffect } from "react";

export default function KeywordAutomationPage() {
  const [keywords, setKeywords] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentEdit, setCurrentEdit] = useState(null);
  const [formData, setFormData] = useState({ key: "", templateSid: "", isActive: true });
  const [error, setError] = useState("");

  const fetchKeywords = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/keyword-automation");
      const json = await res.json();
      if (json.success) setKeywords(json.data);
    } catch (err) {
      console.error("Failed to fetch keywords", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchKeywords();
  }, []);

  const handleOpenModal = (item = null) => {
    setError("");
    if (item) {
      setCurrentEdit(item._id);
      setFormData({ key: item.key, templateSid: item.templateSid, isActive: item.isActive });
    } else {
      setCurrentEdit(null);
      setFormData({ key: "", templateSid: "", isActive: true });
    }
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    if (!formData.key.trim() || !formData.templateSid.trim()) {
      return setError("Keyword and Template SID are required.");
    }

    try {
      const url = currentEdit ? `/api/keyword-automation/${currentEdit}` : "/api/keyword-automation";
      const method = currentEdit ? "PUT" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const result = await res.json();

      if (!result.success) throw new Error(result.error);
      
      setModalOpen(false);
      fetchKeywords();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this keyword?")) return;
    await fetch(`/api/keyword-automation/${id}`, { method: "DELETE" });
    fetchKeywords();
  };

  const handleToggle = async (id, currentStatus) => {
    const updatedStatus = !currentStatus;
    setKeywords(keywords.map(k => k._id === id ? { ...k, isActive: updatedStatus } : k));
    await fetch(`/api/keyword-automation/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: updatedStatus }),
    });
  };

  const filteredKeywords = keywords.filter((k) =>
    k.key.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Keyword Auto Reply</h1>
        <button 
          onClick={() => handleOpenModal()} 
          className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 transition"
        >
          + Add Keyword
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search keywords..."
          className="w-full md:w-1/3 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Keyword</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Template SID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan="4" className="p-4 text-center text-gray-500">Loading...</td></tr>
            ) : filteredKeywords.length === 0 ? (
              <tr><td colSpan="4" className="p-4 text-center text-gray-500">No keywords found.</td></tr>
            ) : (
              filteredKeywords.map((item) => (
                <tr key={item._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-800">{item.key}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.templateSid}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleToggle(item._id, item.isActive)}
                      className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${
                        item.isActive ? "bg-green-500" : "bg-gray-300"
                      }`}
                    >
                      <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${
                        item.isActive ? "translate-x-6" : "translate-x-1"
                      }`} />
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onClick={() => handleOpenModal(item)} className="text-blue-600 hover:text-blue-900 mr-4">Edit</button>
                    <button onClick={() => handleDelete(item._id)} className="text-red-600 hover:text-red-900">Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h2 className="text-xl font-bold mb-4">{currentEdit ? "Edit Keyword" : "Add Keyword"}</h2>
            {error && <div className="bg-red-50 text-red-600 p-2 text-sm rounded mb-4">{error}</div>}
            
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Keyword</label>
                <input
                  type="text"
                  required
                  className="mt-1 w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                  placeholder="e.g. book now"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Template SID</label>
                <input
                  type="text"
                  required
                  className="mt-1 w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.templateSid}
                  onChange={(e) => setFormData({ ...formData, templateSid: e.target.value })}
                  placeholder="e.g. HX1234567890abcdef"
                />
              </div>

              <div className="flex items-center mt-2">
                <input
                  type="checkbox"
                  id="isActive"
                  className="h-4 w-4 text-blue-600 rounded"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                />
                <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">Active Status</label>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}