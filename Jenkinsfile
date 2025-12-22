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
                        sh 'apk add --no-cache docker-cli'
                        sh 'git config --global --add safe.directory "*"'

                        // --- TRƯỜNG HỢP 1: BUILD THEO TAG (Ví dụ: service-python/v1.0 hoặc web-portal/v2.0) ---
                        if (env.TAG_NAME) {
                            def tagParts = env.TAG_NAME.split('/')
                            if (tagParts.length == 2) {
                                def appName = tagParts[0]
                                def version = tagParts[1]

                                // Tự động xác định đường dẫn dựa trên tên App
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
                            // Lấy danh sách file thay đổi một cách an toàn
                            def changedFiles = ""

                            // Kiểm tra xem có commit cha hay không
                            def hasParent = sh(script: "git rev-parse HEAD^", returnStatus: true) == 0

                            if (hasParent) {
                                changedFiles = sh(script: "git diff --name-only HEAD^ HEAD", returnStdout: true).trim()
                            } else {
                                echo "Lần build đầu tiên hoặc không có commit cha, quét toàn bộ repo."
                                changedFiles = sh(script: "git ls-files", returnStdout: true).trim()
                            }

                            if (changedFiles) {
                                // 1. Quét thay đổi trong Backend Apps
                                def backendChanges = sh(script: "echo \"${changedFiles}\" | grep 'backend/src/apps/' | sed -E 's|backend/src/apps/([^/]+)/.*|\\1|' | uniq", returnStdout: true).trim().split('\n')

                                // 2. Quét thay đổi trong Web
                                def webChanged = sh(script: "echo \"${changedFiles}\" | grep 'web/src/'", returnStdout: true).trim()

                                // Xử lý Backend
                                for (appName in backendChanges) {
                                    if (appName && appName != "") {
                                        def servicePath = "backend/src/apps/${appName}"
                                        def devImage = "${DOCKER_PRIVATE_REPO}:${appName}-dev-${env.BUILD_NUMBER}"
                                        buildPushDeploy(appName, servicePath, devImage, true)
                                    }
                                }

                                // Xử lý Frontend (Web)
                                if (webChanged) {
                                    echo "--- Phat hien thay doi trong Web ---"
                                    buildPushDeploy("web-app", "web", "${DOCKER_PRIVATE_REPO}:web-app-dev-${env.BUILD_NUMBER}", true)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

// Hàm hỗ trợ tìm đường dẫn khi Build theo Tag
def findServicePath(appName) {
    if (appName == "web-app") return "web"
    // Kiểm tra xem thư mục có tồn tại trong backend apps không
    def path = "backend/src/apps/${appName}"
    return path
}

def buildPushDeploy(appName, servicePath, imageFull, shouldDeploy) {
    echo "Processing: ${appName} | Path: ${servicePath} | Image: ${imageFull}"

    // Build
    sh "docker build -t ${imageFull} ${servicePath}"

    // Push
    withCredentials([usernamePassword(credentialsId: "${DOCKER_HUB_CREDS}", passwordVariable: 'DOCKER_PASS', usernameVariable: 'DOCKER_USER')]) {
        sh "echo \$DOCKER_PASS | docker login -u \$DOCKER_USER --password-stdin"
        sh "docker push ${imageFull}"
    }

    // Deploy
    if (shouldDeploy) {
        sh "kubectl set image deployment/${appName} python-app=${imageFull}"
        sh "kubectl rollout status deployment/${appName}"
    }
}