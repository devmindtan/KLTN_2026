import time

def count_generator(start=1, step=2):
    count = start
    while True:
        yield count
        count += step


if __name__ == '__main__':
	for message in count_generator():
		print(f"Service 2 đang chạy lần : {message}")
		time.sleep(2)