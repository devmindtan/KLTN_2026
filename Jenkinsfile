import groovy.transform.Field

// --- KHAI BÁO BIẾN TOÀN CỤC ---
@Field def isTestPassed = false
@Field def backendAppsToBuild = ""
@Field def webAppToBuild = ""

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
    }

    stages {
        stage('Stage 1: Phân tích & Kiểm tra') {
            steps {
                container('tools') {
                    script {
                        echo "--- TẦNG 1: KIỂM TRA HỆ THỐNG ---"
                        sh "git config --global --add safe.directory '*'"

                        // Gọi hàm kiểm tra và lấy danh sách cần build
                        if(checkSystemAndGetChanges()){
                            isTestPassed = true
                            def backendLog = backendAppsToBuild ? backendAppsToBuild : "None"
                            def webLog = webAppToBuild ? webAppToBuild : "None"
                            echo "TẦNG 1 XONG. Backend cần build: ${backendLog}. Web cần build ${webLog}"
                        } else {
                            error "Hệ thống trục trặc hoặc không thể kết nối Docker Hub."
                        }
                    }
                }
            }
        }

        stage('Stage 2: Build Image') {
            when { expression { return isTestPassed && (backendAppsToBuild || webAppToBuild) } }
            steps {
                container('tools') {
                    script {
                        echo "--- TẦNG 2: BẮT ĐẦU BUILD ---"
                        if (backendAppsToBuild) {
                            def apps = backendAppsToBuild.split('\n')
                            apps.each { app ->
                                echo "Đang Build Docker Image cho Backend App: ${app}"
                                sh """
                                    cd backend/src/apps/${app}
                                    export PYTHONPATH=.
                                    python3 -m pytest tests/ -vs --tb=line
                                """
                            }
                        }
                        if (webAppToBuild) {
                            def apps = webAppToBuild.split('\n')
                            apps.each { app ->
                                echo "Đang Build Docker Image cho Frontend (Web): ${app}"
                                // Sau này lệnh docker build sẽ nằm ở đây
                            }
                        }
                    }
                }
            }
        }

        stage('Stage 3: Deploy') {
            when {
                anyOf { branch 'develop'; branch 'main' }
                expression { return isTestPassed }
            }
            steps {
                container('tools') {
                    echo "--- TẦNG 3: DEPLOY LÊN K8S ---"
                    echo "Đang triển khai lên nhánh: ${env.BRANCH_NAME}"
                }
            }
        }
    }
}

// --- CÁC HÀM BỔ TRỢ ---

def targetTime() {
    return new Date().format("dd-MM-yyyy HH:mm:ss", TimeZone.getTimeZone('ICT'))
}

def checkSystemAndGetChanges() {
    try {
        echo "Kiểm tra Docker Engine..."
        sh 'apk add --no-cache docker-cli'

        withCredentials([usernamePassword(credentialsId: "${DOCKER_HUB_CREDS}", passwordVariable: 'DOCKER_PASS', usernameVariable: 'DOCKER_USER')]) {
            sh "echo \$DOCKER_PASS | docker login -u \$DOCKER_USER --password-stdin 2>/dev/null"
            sh "docker logout"
        }

        // Lấy danh sách file thay đổi
        def hasParent = sh(script: "git rev-parse HEAD~1", returnStatus: true) == 0
        def rawFiles = hasParent ? sh(script: "git diff --name-only HEAD~1 HEAD", returnStdout: true).trim() : sh(script: "git ls-files", returnStdout: true).trim()

        if (rawFiles) {
            echo "--- DANH SÁCH FILE THAY ĐỔI ---"
            echo rawFiles

            backendAppsToBuild = sh(script: "echo \"${rawFiles}\" | grep '^backend/src/apps/' | cut -d'/' -f4 | sort | uniq", returnStdout: true).trim()

            webAppToBuild = sh(script: "echo \"${rawFiles}\" | grep '^web/' | cut -d'/' -f2 | uniq", returnStdout:
            true).trim()
        }

        return true
    } catch (Exception e) {
        echo "Lỗi: ${e.message}"
        return false
    }
}