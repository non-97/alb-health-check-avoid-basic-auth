export CATALINA_OPTS=" \
  -server \
  -Xms512m \
  -Xmx512m \
  -Xss512k \
  -XX:MetaspaceSize=512m \
  -Djava.security.egd=file:/dev/urandom"
export CATALINA_PID=/usr/local/tomcat/pid/tomcat.pid
export CATALINA_OUT=/var/log/tomcat/catalina.out