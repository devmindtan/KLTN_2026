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

    stages {
        stage('Hello Automation') {
            steps {
                container('tools') {
                    script {
                        // Lấy tên nhánh hiện tại
                        def branch = env.BRANCH_NAME ?: "Unknown Branch"

                        echo "===================================================="
                        echo "HELLO WORLD! TỰ ĐỘNG HÓA THÀNH CÔNG!"
                        echo "Hành động Push đã kích hoạt Pipeline."
                        echo "Bạn vừa đẩy code lên nhánh: ${branch}"
                        echo "Thời gian: ${targetTime()}"
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