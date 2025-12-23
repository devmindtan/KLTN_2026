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
        stage('Hello Automation') {
            steps {
                container('tools') {
                    script {
                        // Lấy tên nhánh hiện tại
                        def branch = env.BRANCH_NAME ?: "Unknown Branch"

                        echo "===================================================="
                        echo "Hành động Push đã kích hoạt Pipeline."
                        echo "Bạn vừa đẩy code lên nhánh: ${branch}"
                        echo "Thời gian: ${targetTime()}"
                        echo "Tiến hành build Docker Hub ${buildPushDeploy()}"

                        echo "\n=====================n==============================="
                        echo "TỰ ĐỘNG HÓA THÀNH CÔNG!"
                        echo "===================================================="
                    }
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

    // 1. Kiểm tra kết nối với Docker Engine (máy HP) thông qua Socket
    sh "docker version"
    echo "Kết nối với Docker Engine thành công!"

    // 2. Kiểm tra kết nối tới Docker Hub bằng Credentials
    withCredentials([usernamePassword(credentialsId: "${DOCKER_HUB_CREDS}", passwordVariable: 'DOCKER_PASS', usernameVariable: 'DOCKER_USER')]) {
        // Sử dụng --password-stdin để bảo mật, không lộ pass trong log
        sh "echo \$DOCKER_PASS | docker login -u \$DOCKER_USER --password-stdin"

        echo "===================================================="
        echo "KẾT NỐI THÀNH CÔNG!"
        echo "Đã đăng nhập vào Docker Hub với user: ${DOCKER_USER}"
        echo "Hệ thống đã sẵn sàng để Build và Push image."
        echo "===================================================="

        // Logout ngay sau khi test để đảm bảo an toàn
        sh "docker logout"
    }
}