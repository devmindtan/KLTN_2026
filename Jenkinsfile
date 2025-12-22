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
        stage('CI/CD Process') {
            steps {
                script {
                    container('tools') {
                        // Cài đặt công cụ và cấu hình Git an toàn
                        sh 'apk add --no-cache docker-cli'
                        sh 'git config --global --add safe.directory "*"'

                        // --- TRƯỜNG HỢP 1: BUILD THEO TAG ---
                        if (env.TAG_NAME) {
                            def tagParts = env.TAG_NAME.split('/')
                            if (tagParts.length == 2) {
                                def appName = tagParts[0]
                                def version = tagParts[1]
                                def servicePath = findServicePath(appName)

                                if (servicePath) {
                                    def publicImage = "${DOCKER_USER}/${appName}:${version}"
                                    echo "--- RELEASE MODE: ${appName} từ ${servicePath} ---"
                                    buildPushDeploy(appName, servicePath, publicImage, true)
                                } else {
                                    error "Khong tim thay thu muc cho app: ${appName}"
                                }
                            }
                        }

                        // --- TRƯỜNG HỢP 2: BUILD NHÁNH DEV (Quét thay đổi) ---
                        else if (env.BRANCH_NAME == 'develop') {
                            def changedFiles = ""
                            def hasParent = sh(script: "git rev-parse HEAD^", returnStatus: true) == 0

                            if (hasParent) {
                                changedFiles = sh(script: "git diff --name-only HEAD^ HEAD", returnStdout: true).trim()
                            } else {
                                echo "Lần build đầu tiên hoặc không có commit cha, quét toàn bộ repo."
                                changedFiles = sh(script: "git ls-files", returnStdout: true).trim()
                            }

                            if (changedFiles) {
                                echo "Cac file thay doi:\n${changedFiles}"

                                // Lọc các App Backend thay đổi (thêm || true để không crash nếu không tìm thấy)
                                def backendAppsStr = sh(
                                    script: "echo \"${changedFiles}\" | grep 'backend/src/apps/' | sed -E 's|backend/src/apps/([^/]+)/.*|\\1|' | uniq || true",
                                    returnStdout: true
                                ).trim()

                                // Kiểm tra Web thay đổi
                                def webChanged = sh(
                                    script: "echo \"${changedFiles}\" | grep 'web/src/' || true",
                                    returnStdout: true
                                ).trim()

                                // Thực hiện Build Backend nếu có thay đổi
                                if (backendAppsStr) {
                                    def backendApps = backendAppsStr.split('\n')
                                    for (appName in backendApps) {
                                        if (appName) {
                                            def servicePath = "backend/src/apps/${appName}"
                                            def devImage = "${DOCKER_PRIVATE_REPO}:${appName}-dev-${env.BUILD_NUMBER}"
                                            echo "--- BUILD BACKEND: ${appName} ---"
                                            buildPushDeploy(appName, servicePath, devImage, true)
                                        }
                                    }
                                }

                                // Thực hiện Build Web nếu có thay đổi
                                if (webChanged) {
                                    echo "--- Phat hien thay doi trong Web ---"
                                    def webImage = "${DOCKER_PRIVATE_REPO}:web-app-dev-${env.BUILD_NUMBER}"
                                    buildPushDeploy("web-app", "web", webImage, true)
                                }

                                if (!backendAppsStr && !webChanged) {
                                    echo "Khong co thay doi trong code ung dung (Backend/Web). Bo qua build."
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

def findServicePath(appName) {
    if (appName == "web-app") return "web"
    return "backend/src/apps/${appName}"
}

def buildPushDeploy(appName, servicePath, imageFull, shouldDeploy) {
    echo "Processing: ${appName} | Path: ${servicePath} | Image: ${imageFull}"

    // 1. Build Image
    sh "docker build -t ${imageFull} ${servicePath}"

    // 2. Login và Push lên Docker Hub
    withCredentials([usernamePassword(credentialsId: "${DOCKER_HUB_CREDS}", passwordVariable: 'DOCKER_PASS', usernameVariable: 'DOCKER_USER')]) {
        sh "echo \$DOCKER_PASS | docker login -u \$DOCKER_USER --password-stdin"
        sh "docker push ${imageFull}"
    }

    // 3. Cập nhật Deployment trong K8s
    if (shouldDeploy) {
        // Lưu ý: Tên container trong file Deployment phải khớp với logic này (appName hoặc python-app)
        sh "kubectl set image deployment/${appName} ${appName}=${imageFull} || kubectl set image deployment/${appName} python-app=${imageFull}"
        sh "kubectl rollout status deployment/${appName}"
    }

    // Dọn dẹp image sau khi push để tiết kiệm ổ đĩa máy HP
    sh "docker rmi -f ${imageFull} || true"
}