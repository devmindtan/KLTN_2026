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
                    script {
                        echo "--- TẦNG 1: KIỂM TRA HỆ THỐNG ---"
                        def branch = env.BRANCH_NAME ?: "Unknown Branch"
                        echo "Nhánh hiện tại: ${branch}"
                        echo "Thời gian: ${targetTime()}"

                        // Chạy kiểm tra kết nối
                        checkDockerConnection()

                        echo "===================================================="
                        echo "TẦNG 1 HOÀN TẤT!"
                        echo "===================================================="
                    }
                }
            }
        }

        stage('Stage 2: Build Image') {
            when {
                // Tạm thời để true để bạn thấy nó sáng đèn
                expression { return true }
            }
            steps {
                container('tools') {
                    echo "--- TẦNG 2: MÔ PHỎNG BUILD IMAGE ---"
                    echo "Hệ thống sẽ build image từ source code tại đây."
                }
            }
        }

        stage('Stage 3: Deploy') {
            when {
                anyOf {
                    branch 'develop'
                    branch 'main'
                }
                expression { return true }
            }
            steps {
                container('tools') {
                    echo "--- TẦNG 3: MÔ PHỎNG DEPLOY K8S ---"
                    echo "Đang triển khai lên môi trường: ${env.BRANCH_NAME}"
                }
            }
        }
    }
}

// --- CÁC HÀM BỔ TRỢ ---

def targetTime() {
    return new Date().format("dd-MM-yyyy HH:mm:ss", TimeZone.getTimeZone('ICT'))
}

def checkDockerConnection() {
    echo "--- Đang kiểm tra kết nối Docker ---"
    sh 'apk add --no-cache docker-cli'
    sh "docker version"

    withCredentials([usernamePassword(credentialsId: "${DOCKER_HUB_CREDS}", passwordVariable: 'DOCKER_PASS', usernameVariable: 'DOCKER_USER')]) {
        sh "echo \$DOCKER_PASS | docker login -u \$DOCKER_USER --password-stdin 2>/dev/null"
        echo "Đã đăng nhập thành công Docker Hub: ${DOCKER_USER}"
        sh "docker logout"
    }
}