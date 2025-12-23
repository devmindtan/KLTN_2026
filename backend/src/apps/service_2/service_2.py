import time

def main():
    count = 1
    while True:
        print(f"Service 2 đang chạy lần {count}")
        count += 1
        time.sleep(2)

if __name__ == '__main__':
    main()