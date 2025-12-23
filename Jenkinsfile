pipeline {
    agent {
        kubernetes {
            yaml '''
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: tools
    image: alpine/k8s:1.28.3
    command: ['cat']
    tty: true
    securityContext:
      runAsUser: 0
    volumeMounts:
    - mountPath: /var/run/docker.sock
      name: docker-sock
  volumes:
  - name: docker-sock
    hostPath:
      path: /var/run/docker.sock
'''
        }
    }

    environment {
        DOCKER_USER = "devmindtan"
        DOCKER_HUB_CREDS = 'docker-hub-creds'
        DOCKER_PRIVATE_REPO = "devmindtan/private-repo"
    }
    stages {
        stage('Stage 1: Linting & Unit Test') {
            steps {
                container('tools') {
                    echo "--- Đang kiểm tra cú pháp và chạy Unit Test cho toàn bộ Repo ---"
                    // Chạy các lệnh kiểm tra nhanh ở đây
                    def branch = env.BRANCH_NAME ?: "Unknown Branch"

                    echo "===================================================="
                    echo "Hành động Push đã kích hoạt Pipeline."
                    echo "Bạn vừa đẩy code lên nhánh: ${branch}"
                    echo "Thời gian: ${targetTime()}"
                    echo "Tiến hành build Docker Hub ${buildPushDeploy()}"

                    echo "=====================n==============================="
                    echo "TỰ ĐỘNG HÓA THÀNH CÔNG!"
                    echo "===================================================="
                }
            }
        }
        stage('Stage 2: Build Image') {
            when {
                // Chỉ chạy khi code trong thư mục backend hoặc web thay đổi
                expression {
                    return True //checkCodeChanges()
                }
            }
            steps {
                container('tools') {
                    echo "--- Phát hiện thay đổi trong code hệ thống. Bắt đầu Build Docker Image ---"
                    // Gọi hàm buildPushDeploy() của bạn ở đây
                }
            }
        }

        // TẦNG 3: Chỉ chạy khi merge vào nhánh develop hoặc main
        stage('Stage 3: Integration Test & Deploy') {
            when {
                anyOf {
                    branch 'develop'
                    branch 'main'
                }
                // Thêm điều kiện: Phải có thay đổi code mới Deploy
                expression { return True //checkCodeChanges() }
            }
            steps {
                container('tools') {
                    echo "--- Đang thực hiện Deploy lên môi trường: ${env.BRANCH_NAME} ---"
                    // Chạy lệnh kubectl set image ở đây
                }
            }
        }
    }
}

// Hàm bổ trợ lấy thời gian hiện tại
def targetTime() {
    return new Date().format("dd-MM-yyyy HH:mm:ss", TimeZone.getTimeZone('ICT'))
}

def buildPushDeploy() {
    echo "--- Đang kiểm tra kết nối hệ thống ---"
    sh 'apk add --no-cache docker-cli'

    // 1. Kiểm tra kết nối với Docker Engine (máy HP) thông qua Socket
    sh "docker version"
    echo "Kết nối với Docker Engine thành công!"

    // 2. Kiểm tra kết nối tới Docker Hub bằng Credentials
    withCredentials([usernamePassword(credentialsId: "${DOCKER_HUB_CREDS}", passwordVariable: 'DOCKER_PASS', usernameVariable: 'DOCKER_USER')]) {
        // Sử dụng --password-stdin để bảo mật, không lộ pass trong log
        sh "echo \$DOCKER_PASS | docker login -u \$DOCKER_USER --password-stdin 2>/dev/null"

        echo "===================================================="
        echo "KẾT NỐI THÀNH CÔNG!"
        echo "Đã đăng nhập vào Docker Hub với user: ${DOCKER_USER}"
        echo "Hệ thống đã sẵn sàng để Build và Push image."
        echo "===================================================="

        // Logout ngay sau khi test để đảm bảo an toàn
        sh "docker logout"
    }
}

// HÀM HỖ TRỢ (Helper Function) để lọc file thay đổi
def checkCodeChanges() {
    // Lấy danh sách file thay đổi giữa commit hiện tại và commit trước đó
    def changedFiles = sh(script: "git diff --name-only HEAD^ HEAD || true", returnStdout: true).trim()

    // Kiểm tra xem có file nào nằm trong các thư mục code quan trọng không
    // (Dùng Regex để bỏ qua README.md, .txt, .docs, v.v.)
    def hasCodeChange = sh(
        script: "echo \"${changedFiles}\" | grep -E '^(backend/|web/)' | grep -vE '\\.(md|txt|docs)$' || true",
        returnStatus: true
    ) == 0

    return hasCodeChange
}