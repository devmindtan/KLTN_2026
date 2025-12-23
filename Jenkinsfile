// Tạo biến global
def isTestPassed = false

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
                        if(checkDockerConnection()){
                            isTestPassed = true
                            echo "===================================================="
                            echo "TẦNG 1 HOÀN TẤT! - QUA TẦNG 2"
                            echo "===================================================="
                        }
                        else{
                            error "Dừng lại! Code có lỗi cú pháp, không được phép qua tầng 2."
                        }
                    }
                }
            }
        }

        stage('Stage 2: Build Image') {
            when {
                // Tạm thời để true để bạn thấy nó sáng đèn
                expression { return isTestPassed }
            }
            steps {
                container('tools') {
                    echo "--- TẦNG 2: MÔ PHỎNG BUILD IMAGE ---"
                    echo "Hệ thống sẽ build image từ source code tại đây."
                    script {
                        if(true){
                            isTestPassed = true
                            echo "===================================================="
                            echo "TẦNG 2 HOÀN TẤT! - QUA TẦNG 3"
                            echo "===================================================="
                        }
                        else{
                            error "Dừng lại! Code có lỗi cú pháp, không được phép qua tầng 3."
                        }
                    }
                }
            }
        }

        stage('Stage 3: Deploy') {
            when {
                anyOf {
                    branch 'develop'
                    branch 'main'
                }
                expression { return isTestPassed }
            }
            steps {
                container('tools') {
                    echo "--- TẦNG 3: MÔ PHỎNG DEPLOY K8S ---"
                    echo "Đang triển khai lên môi trường: ${env.BRANCH_NAME}"

                    script {
                        if(true){
                            echo "===================================================="
                            echo "TẦNG 3 HOÀN TẤT! - BUILD THÀNH CÔNG"
                            echo "===================================================="
                        }
                        else{
                            error "Dừng lại! Code có lỗi cú pháp, hãy kiểm tra lại trước khi build lại."
                        }
                    }
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
    try {
        echo "--- Đang kiểm tra kết nối Docker ---"
        sh 'apk add --no-cache docker-cli'
        sh "docker version"
        withCredentials([usernamePassword(credentialsId: "${DOCKER_HUB_CREDS}", passwordVariable: 'DOCKER_PASS', usernameVariable: 'DOCKER_USER')]) {
            sh "echo \$DOCKER_PASS | docker login -u \$DOCKER_USER --password-stdin 2>/dev/null"
            sh "docker logout"
        }

        def result = sh(script: "git diff --name-only HEAD^ HEAD | sed -E 's|.*/||'", returnStdout: true).trim()
        def fileList = result.split('\n')

        echo "${fileList}"

        fileList.each { fileName ->
            echo "Đang xử lý file: ${fileName}"
        }

        return true
    } catch (Exception e) {
        error "Lỗi kết nối: ${e.message}"
        return false
    }
}