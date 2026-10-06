"use client";

import React, { useState } from "react";
import { useLocale } from "@/lib/i18n/locale-provider";

// Kiểu dữ liệu lịch sử bài làm
interface HistoryItem {
  id: string;
  testName: string;
  date: string;
  score: number;
  maxScore: number;
  duration: string;
  status: "completed" | "in_progress";
  note: string;
  totalQuestions: number;
  correctAnswers: number;
}

export default function StudentHistoryPage() {
  const { t } = useLocale();

  // 1. Mock Data (Dữ liệu mẫu cho tính năng READ)
  const [historyList, setHistoryList] = useState<HistoryItem[]>([
    {
      id: "HIST-001",
      testName: "Kiểm tra giữa kỳ - Lập trình Web",
      date: "2026-03-10 14:30",
      score: 8.5,
      maxScore: 10,
      duration: "45 phút",
      status: "completed",
      note: "Cần ôn lại kiến thức React Hooks",
      totalQuestions: 40,
      correctAnswers: 34,
    },
    {
      id: "HIST-002",
      testName: "Luyện tập SQL & Database",
      date: "2026-03-12 09:15",
      score: 6.0,
      maxScore: 10,
      duration: "30 phút",
      status: "completed",
      note: "Sai nhiều ở phần Join table",
      totalQuestions: 20,
      correctAnswers: 12,
    },
    {
      id: "HIST-003",
      testName: "Thi thử Java OOP - Lần 1",
      date: "2026-03-14 16:00",
      score: 0,
      maxScore: 10,
      duration: "10 phút",
      status: "in_progress",
      note: "Bài thi nháp chưa hoàn thành",
      totalQuestions: 30,
      correctAnswers: 0,
    },
  ]);

  // State quản lý tìm kiếm
  const [searchTerm, setSearchTerm] = useState("");

  // State quản lý Modal (Xem chi tiết & Cập nhật)
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editNoteValue, setEditNoteValue] = useState("");

  // --- THAO TÁC READ (Lọc tìm kiếm) ---
  const filteredHistory = historyList.filter((item) =>
    item.testName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // --- THAO TÁC UPDATE (Cập nhật Ghi chú) ---
  const handleOpenEdit = (item: HistoryItem) => {
    setSelectedItem(item);
    setEditNoteValue(item.note);
    setIsEditOpen(true);
  };

  const handleSaveNote = () => {
    if (!selectedItem) return;
    setHistoryList((prev) =>
      prev.map((item) =>
        item.id === selectedItem.id ? { ...item, note: editNoteValue } : item
      )
    );
    setIsEditOpen(false);
    setSelectedItem(null);
  };

  // --- THAO TÁC DELETE (Xóa lịch sử nháp/thi thử) ---
  const handleDelete = (id: string) => {
    if (confirm(t("history.actions.confirm_delete"))) {
      setHistoryList((prev) => prev.filter((item) => item.id !== id));
    }
  };

  // Xem chi tiết
  const handleOpenDetail = (item: HistoryItem) => {
    setSelectedItem(item);
    setIsDetailOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">
          {t("history.title")}
        </h1>
        <p className="text-gray-500 text-sm mt-1">{t("history.subtitle")}</p>
      </div>

      {/* Thanh tìm kiếm */}
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <input
          type="text"
          placeholder={t("history.search_placeholder")}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
      </div>

      {/* Bảng danh sách Lịch sử (READ) */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider">
              <th className="p-4">{t("history.table.test_name")}</th>
              <th className="p-4">{t("history.table.date")}</th>
              <th className="p-4">{t("history.table.score")}</th>
              <th className="p-4">{t("history.table.duration")}</th>
              <th className="p-4">{t("history.table.status")}</th>
              <th className="p-4">{t("history.table.note")}</th>
              <th className="p-4 text-right">{t("history.table.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {filteredHistory.length > 0 ? (
              filteredHistory.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition">
                  <td className="p-4 font-semibold text-gray-800">
                    {item.testName}
                  </td>
                  <td className="p-4 text-gray-600">{item.date}</td>
                  <td className="p-4 font-bold text-blue-600">
                    {item.score} / {item.maxScore}
                  </td>
                  <td className="p-4 text-gray-600">{item.duration}</td>
                  <td className="p-4">
                    <span
                      className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${
                        item.status === "completed"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {item.status === "completed"
                        ? t("history.status.completed")
                        : t("history.status.in_progress")}
                    </span>
                  </td>
                  <td className="p-4 text-gray-500 italic max-w-xs truncate">
                    {item.note || "—"}
                  </td>
                  <td className="p-4 text-right space-x-2">
                    {/* Nút READ: Xem chi tiết */}
                    <button
                      onClick={() => handleOpenDetail(item)}
                      className="text-blue-600 hover:text-blue-800 font-medium px-2 py-1 text-xs border border-blue-200 rounded hover:bg-blue-50"
                    >
                      {t("history.actions.view")}
                    </button>

                    {/* Nút UPDATE: Chỉnh sửa Ghi chú */}
                    <button
                      onClick={() => handleOpenEdit(item)}
                      className="text-amber-600 hover:text-amber-800 font-medium px-2 py-1 text-xs border border-amber-200 rounded hover:bg-amber-50"
                    >
                      {t("history.actions.edit_note")}
                    </button>

                    {/* Nút DELETE: Xóa lượt làm bài */}
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-red-600 hover:text-red-800 font-medium px-2 py-1 text-xs border border-red-200 rounded hover:bg-red-50"
                    >
                      {t("history.actions.delete")}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-400">
                  Không tìm thấy lịch sử làm bài nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL 1: XEM CHI TIẾT BÀI LÀM (READ) */}
      {isDetailOpen && selectedItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-lg space-y-4">
            <h3 className="text-lg font-bold border-b pb-2">
              {t("history.modal.detail_title")}
            </h3>
            <div className="space-y-2 text-sm">
              <p>
                <strong>{t("history.table.test_name")}:</strong>{" "}
                {selectedItem.testName}
              </p>
              <p>
                <strong>{t("history.table.date")}:</strong> {selectedItem.date}
              </p>
              <p>
                <strong>{t("history.table.score")}:</strong>{" "}
                <span className="text-blue-600 font-bold">
                  {selectedItem.score} / {selectedItem.maxScore}
                </span>
              </p>
              <p>
                <strong>{t("history.modal.correct_answers")}:</strong>{" "}
                {selectedItem.correctAnswers} / {selectedItem.totalQuestions}
              </p>
              <p>
                <strong>{t("history.table.duration")}:</strong>{" "}
                {selectedItem.duration}
              </p>
              <p>
                <strong>{t("history.table.note")}:</strong> {selectedItem.note}
              </p>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsDetailOpen(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CẬP NHẬT GHI CHÚ (UPDATE) */}
      {isEditOpen && selectedItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-lg space-y-4">
            <h3 className="text-lg font-bold border-b pb-2">
              {t("history.modal.edit_title")}
            </h3>
            <div>
              <label className="block text-sm font-medium mb-1">
                {t("history.table.note")}
              </label>
              <textarea
                rows={3}
                value={editNoteValue}
                onChange={(e) => setEditNoteValue(e.target.value)}
                className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsEditOpen(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
              >
                {t("history.actions.cancel")}
              </button>
              <button
                onClick={handleSaveNote}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                {t("history.actions.save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}