pipeline {
  agent any
  stages {
    stage('verify') {
      steps {
        fileExists 'Dockerfile'
      }
    }
    stage('build') {
      steps {
        sh 'docker build -t $IMAGE:$TAG .'
      }
    }
    stage('deploy') {
      steps {
        sh 'docker push $IMAGE:$TAG'
      }
    }
  }
}