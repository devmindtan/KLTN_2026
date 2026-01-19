# conftest.py
def pytest_report_header(config):
	# Lấy giá trị của tham số -v (verbose) nếu người dùng có nhập
	is_verbose = config.getoption("verbose") > 0
	if is_verbose:
		return "Chế độ chạy: Chi tiết (Verbose) \nĐồ án KLTN 2026 - Testing cho Service 2"
	return "Chế độ chạy: Rút gọn \nĐồ án KLTN 2026 - Testing cho Service 2"

def pytest_terminal_summary(terminalreporter, exitstatus, config):
    passed = len(terminalreporter.stats.get('passed', []))
    failed = len(terminalreporter.stats.get('failed', []))
    
    print(f"Thành công: {passed}")
    print(f"Thất bại: {failed}")
    
    print(f"\nKết quả cuối cùng: {'THÀNH CÔNG' if exitstatus == 0 else 'THẤT BẠI'}")
