"use client";

import React, { useState } from "react";
import { useLocale } from "@/lib/i18n/locale-provider";

export default function StudentProfilePage() {
  const { t } = useLocale();

  // State dữ liệu (Read)
  const [studentInfo, setStudentInfo] = useState({
    name: "Nguyen Van A",
    email: "student@example.com",
    phone: "0901234567",
  });

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(studentInfo);

  // Thao tác Update
  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    setStudentInfo(formData);
    setIsEditing(false);
    // TODO: Gọi API PUT/PATCH cập nhật dữ liệu xuống Backend
  };

  // Thao tác Delete
  const handleDelete = () => {
    if (confirm("Bạn có chắc chắn muốn xóa/hủy thông tin này không?")) {
      setStudentInfo({ name: "", email: "", phone: "" });
      // TODO: Gọi API DELETE xuống Backend
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{t("student_profile.title")}</h1>

      <div className="bg-white rounded-lg shadow p-6">
        {!isEditing ? (
          /* READ VIEW */
          <div className="space-y-4">
            <div>
              <label className="text-gray-500 text-sm">Họ và tên</label>
              <p className="font-semibold text-lg">{studentInfo.name || "N/A"}</p>
            </div>
            <div>
              <label className="text-gray-500 text-sm">Email</label>
              <p className="font-semibold text-lg">{studentInfo.email || "N/A"}</p>
            </div>
            <div>
              <label className="text-gray-500 text-sm">Số điện thoại</label>
              <p className="font-semibold text-lg">{studentInfo.phone || "N/A"}</p>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {t("student_profile.edit")}
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                {t("student_profile.delete_account")}
              </button>
            </div>
          </div>
        ) : (
          /* UPDATE FORM */
          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Họ và tên</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full border p-2 rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Số điện thoại</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full border p-2 rounded"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Lưu
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                Hủy
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}