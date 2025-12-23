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
    image: devmindtan/base-build-kltn-2026:v1.0.0
    command: ['cat']
    tty: true
    securityContext:
      privileged: true
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
                        sh '''
                            echo "--- KIỂM TRA MÔI TRƯỜNG ---"
                            python3 -m pytest --version
                            node -v
                            npm -v
                            docker version
                        '''
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

        stage('Stage 2: Build & Push Image') {
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
                                def imageName = ""
                                if (env.BRANCH_NAME == 'develop') {
                                    imageName = "devmindtan/private-repo:${app}-v1.0.0"
                                } else {
                                    imageName = "devmindtan/${app}:v1.0.0"
                                }

                                echo "Đang Build & Push Image cho: ${imageName}"
                                sh """
                                    cd web/${app}
                                    docker build -t ${imageName} .
                                    docker push ${imageName}
                                """
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
                    script {
                        echo "--- TẦNG 3: DEPLOY LÊN K8S ---"
                        if (backendAppsToBuild) {
                            def apps = backendAppsToBuild.split('\n')
                            apps.each { app ->
                                echo "Đang Deploy Docker Image cho Backend App: ${app}"
                                def shortName = (env.BRANCH_NAME == 'develop') ? "private-repo-${app}" : "${app}"
                                def deployResource = "deployment/${shortName}"

                                def imageName = (env.BRANCH_NAME == 'develop') ?
                                    "devmindtan/private-repo:${app}-v1.0.0" :
                                    "devmindtan/${app}:v1.0.0"

                                def exists = sh(script: "kubectl get ${deployResource}", returnStatus: true)
                                if (exists != 0) {
                                     echo "--- LẦN ĐẦU: Tạo mới Deployment ${shortName} ---"
                                     // Quan trọng: Create đúng cái tên đã check ở trên
                                     sh "kubectl create deployment ${shortName} --image=${imageName}"
                                } else {
                                     echo "--- CẬP NHẬT: Đang set image mới cho ${shortName} ---"
                                     // Khi dùng lệnh create ở trên, K8s mặc định đặt tên container trùng với tên deployment
                                     sh "kubectl set image ${deployResource} ${shortName}=${imageName}"
                                }
                                sh "kubectl rollout status ${deployResource}"
                            }
                        }
                        if (webAppToBuild) {
                            def apps = webAppToBuild.split('\n')
                            apps.each { app ->
                                echo "Đang Deploy Docker Image cho Web App: ${app}"
                                // 1. Định nghĩa tên ngắn gọn cho Deployment (Không đổi qua các lần build)
                                def shortName = (env.BRANCH_NAME == 'develop') ? "private-repo-${app}" : "${app}"
                                def deployResource = "deployment/${shortName}"

                                def imageName = (env.BRANCH_NAME == 'develop') ?
                                    "devmindtan/private-repo:${app}-v1.0.0" :
                                    "devmindtan/${app}:v1.0.0"

                                // 2. Kiểm tra xem Deployment đã tồn tại chưa
                                def exists = sh(script: "kubectl get ${deployResource}", returnStatus: true)

                                if (exists == 0) {
                                     echo "--- LẦN ĐẦU: Tạo mới Deployment ${shortName} ---"
                                     // Quan trọng: Create đúng cái tên đã check ở trên
                                     sh "kubectl create deployment ${shortName} --image=${imageName}"

                                     def targetPort = (app.contains('web-user')) ? 5173 : 5174

                                     sh """
                                     kubectl expose deployment ${shortName} --type=NodePort --port=80
                                     --target-port=${targetPort}
                                     """

                                } else {
                                     echo "--- CẬP NHẬT: Đang set image mới cho ${shortName} ---"
                                     // Khi dùng lệnh create ở trên, K8s mặc định đặt tên container trùng với tên deployment
                                     sh "kubectl set image ${deployResource} ${shortName}=${imageName}"
                                }

                                // 3. Đợi K8s thay thế Pod cũ bằng Pod mới thành công
                                sh "kubectl rollout status ${deployResource}"
                            }
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

def checkSystemAndGetChanges() {
    try {
        echo "Kiểm tra Docker Engine..."

        withCredentials([usernamePassword(credentialsId: "${DOCKER_HUB_CREDS}", passwordVariable: 'DOCKER_PASS', usernameVariable: 'DOCKER_USER')]) {
            sh "echo \$DOCKER_PASS | docker login -u \$DOCKER_USER --password-stdin 2>/dev/null"
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