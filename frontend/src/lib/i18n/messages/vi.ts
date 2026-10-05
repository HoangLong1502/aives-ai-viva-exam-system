import type { Messages } from "./en";

export const vi: Messages = {
  common: {
    signOut: "Đăng xuất",
    home: "Trang chủ",
    admin: "Quản trị",
    or: "hoặc",
    languageSwitch: "Ngôn ngữ giao diện",
  },
  roles: {
    student: "Sinh viên",
    teacher: "Giảng viên",
    admin: "Quản trị viên",
  },
  brand: {
    tagline: "Hệ thống thi vấn đáp AI",
    workspace: "Không gian viva",
    adminEyebrow: "Quản trị hệ thống",
  },
  nav: {
    teacher: {
      bank: "Ngân hàng câu hỏi & rubric",
      tests: "Mở bài kiểm tra",
      scores: "Điểm số",
    },
    student: {
      tests: "Bài kiểm tra",
      scores: "Điểm số",
    },
    admin: {
      dashboard: "Tổng quan",
      people: "Người dùng",
      performance: "Hiệu năng",
      settings: "Cài đặt",
      knowledge: "Tri thức",
    },
  },
  errors: {
    wrongRolePortal: "Màn hình này dành cho vai trò khác.",
    adminOnly: "Chỉ quản trị viên mới mở được bảng điều khiển này.",
    chooseRole: "Chọn Sinh viên, Giảng viên hoặc Quản trị viên để vào.",
    roleMismatch: "Tài khoản này là {role}. Hãy chọn đúng vai trò để vào.",
    apiUnreachable: "Không kết nối được API AIVES. Backend đã chạy chưa?",
  },
  login: {
    heroTitle: "Thi vấn đáp nên giống một cuộc trò chuyện, không phải rút thăm may rủi.",
    heroLead:
      "Câu hỏi viva thích ứng, chấm điểm nhất quán và phòng thi êm ái cho thí sinh lẫn giám khảo.",
    heroBullets: [
      "Câu hỏi bám theo lập luận của thí sinh",
      "Rubric chung thay vì chấm theo cảm tính",
      "Lưu lại toàn bộ buổi viva để xem lại",
    ],
    heroFooter: "Dành cho khoa vẫn tin vào hình thức vấn đáp.",
    createAccount: "Tạo tài khoản",
    signIn: "Đăng nhập",
    joinHall: "Gia nhập phòng thi",
    enterHall: "Vào phòng thi",
    createLead: "Tài khoản mới mặc định là sinh viên.",
    signInLead: "Chọn vai trò, rồi đăng nhập để mở màn hình tương ứng.",
    roleLegend: "Vai trò",
    name: "Họ tên",
    email: "Email",
    password: "Mật khẩu",
    passwordHint: "Mật khẩu tối thiểu 8 ký tự.",
    showPassword: "Hiện mật khẩu",
    hidePassword: "Ẩn mật khẩu",
    creatingAccount: "Đang tạo tài khoản",
    checkingCredentials: "Đang xác thực",
    continue: "Tiếp tục",
    alreadyHave: "Đã có tài khoản?",
    newHere: "Mới tham gia?",
    createAnAccount: "Tạo tài khoản",
    welcome: "Chào {name}.",
  },
  home: {
    greetingMorning: "Chào buổi sáng",
    greetingAfternoon: "Chào buổi chiều",
    greetingEvening: "Chào buổi tối",
    studentLead:
      "Đây là bàn thi của bạn. Bài trắc nghiệm và viva miệng được giao sẽ hiện ở đây.",
    teacherLead:
      "Đây là phòng thi của bạn. Các ca thi bạn phụ trách, viết hoặc miệng, sẽ hiện ở đây.",
    upcomingVivas: "Viva sắp tới",
    noSessionsYet: "Chưa có ca thi nào",
    completed: "Đã hoàn thành",
    resultsCollect: "Kết quả sẽ tập hợp tại đây",
    readyTitle: "Sẵn sàng khi bạn cần",
    examHall: "Phòng thi",
    banksNext: "Ngân hàng câu hỏi và chấm điểm sắp có",
    vivaSessions: "Ca viva",
    assignedList: "Các kỳ viva được giao sẽ hiện trong danh sách này.",
    quietHall: "Phòng thi vẫn đang yên lặng",
    emptyStart:
      "Khi tạo kỳ thi được bật, thí sinh và giảng viên sẽ mở viva từ bảng này. Chưa có gì thiếu — đây là điểm bắt đầu trống.",
  },
  teacher: {
    bank: {
      eyebrow: "Ngân hàng câu hỏi & rubric",
      title: "Quản lý câu hỏi viva",
      lead: "Nhập tài liệu môn học, viết hoặc import câu hỏi miệng, gắn mức Bloom và rubric chấm điểm. Bản nháp AI được duyệt tại đây hoặc khi mở bài kiểm tra trước khi vào ngân hàng chính thức.",
      subjectTitle: "Môn học & tài liệu",
      subjectDesc:
        "Tạo môn học, rồi import PDF, DOCX hoặc PPTX. File được lập chỉ mục cho RAG khi soạn câu hỏi lúc tạo bài kiểm tra.",
      codePlaceholder: "Mã môn",
      namePlaceholder: "Tên môn",
      createSubject: "Tạo môn học",
      createSubjectFirst: "Hãy tạo môn học trước",
      addTitle: "Thêm câu hỏi",
    },
    tests: {
      eyebrow: "Bài kiểm tra",
      title: "Mở bài kiểm tra viva",
      lead: "Soạn câu hỏi miệng từ tài liệu đã import, duyệt rồi mở ca thi với bộ câu đã duyệt.",
      draftTitle: "Soạn từ tài liệu",
      draftDesc:
        "Dùng RAG trên slide hoặc giáo trình đã tải lên. Bản nháp chưa vào ngân hàng chính thức cho đến khi bạn duyệt.",
      noSubjects: "Chưa có môn học",
    },
    scores: {
      eyebrow: "Điểm số",
      title: "Kết quả sinh viên",
    },
  },
  student: {
    tests: {
      eyebrow: "Sinh viên",
      title: "Bài kiểm tra đang mở",
      lead: "Vào ca thi giảng viên đã mở. Điểm hiện sau khi giảng viên ghi nhận.",
      oral: "Viva miệng",
      multipleChoice: "Trắc nghiệm",
      score: "Điểm",
      open: "Mở lại",
      enter: "Vào thi",
      noQuestions: "Ca thi chưa gắn câu hỏi từ ngân hàng.",
    },
    scores: {
      eyebrow: "Điểm số",
      title: "Kết quả của bạn",
    },
  },
};
