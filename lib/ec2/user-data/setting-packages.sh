#!/bin/bash

# -x to display the command to be executed
set -xu
set +e

# Redirect /var/log/user-data.log and /dev/console
exec > >(tee /var/log/user-data.log | logger -t user-data -s 2>/dev/console) 2>&1

declare -r max_retry_interval=8
declare -r max_retries=4

# Install Corretto 17 and httpd
for i in $(seq 1 $max_retries); do
  rpm --import https://yum.corretto.aws/corretto.key
  curl -s -L -o /etc/yum.repos.d/corretto.repo https://yum.corretto.aws/corretto.repo
  dnf clean all
  dnf install -y \
    java-17-amazon-corretto-devel \
    httpd

  if [[ $? == 0 ]]; then
    break
  else
    retry_interval=$(($RANDOM % $max_retry_interval))

    echo "Failed to install packages, retrying in $retry_interval seconds..."
    sleep $retry_interval
  fi
done

if [[ $i == $max_retries ]]; then
  echo "Failed to install packages after $max_retries retries. Please manually install packages."
  exit 1
fi

# Unzip assets
unzip /tmp/assets/tomcat.zip -d /tmp/assets/tomcat
unzip /tmp/assets/httpd.zip -d /tmp/assets/httpd

# Tomcat 
# Install
cd /usr/local/
curl -s https://dlcdn.apache.org/tomcat/tomcat-10/v10.1.15/bin/apache-tomcat-10.1.15.tar.gz -o apache-tomcat-10.1.15.tar.gz
tar zxf apache-tomcat-10.1.15.tar.gz
rm -rf apache-tomcat-10.1.15.tar.gz

# symbolic link
ln -s apache-tomcat-10.1.15 tomcat
ls -l | grep tomcat

# Add tomcat user
useradd tomcat -M -s /sbin/nologin
id tomcat

mkdir -p ./tomcat/pid/
mkdir -p /var/log/tomcat/

# tomcat log tomcat label
semanage fcontext -a -t tomcat_log_t "/var/log/tomcat(/.*)?"
restorecon -R /var/log/tomcat/

# setenv.sh
mv /tmp/assets/tomcat/bin/setenv.sh ./tomcat/bin/setenv.sh

# conf
\cp -prf /tmp/assets/tomcat/conf/* ./tomcat/conf/

# appBase
mkdir ./tomcat/webapps_sample1

chown tomcat:tomcat -R ./tomcat/
chown tomcat:tomcat -R /var/log/tomcat/

# systemd
tee /etc/systemd/system/tomcat.service << EOF
[Unit]
Description=Apache Tomcat Web Application Container
ConditionPathExists=/usr/local/tomcat
After=syslog.target network.target

[Service]
User=tomcat
Group=tomcat
Type=oneshot
RemainAfterExit=yes

ExecStart=/usr/local/tomcat/bin/startup.sh
ExecStop=/usr/local/tomcat/bin/shutdown.sh

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl list-unit-files --type=service | grep tomcat

systemctl enable --now tomcat


# httpd
# Set config file
\cp -prf /tmp/assets/httpd/* /etc/httpd/

# Disable Welcome page
cat /dev/null > /etc/httpd/conf.d/welcome.conf

# Disable Auto Index
mv /etc/httpd/conf.d/autoindex.conf /etc/httpd/conf.d/autoindex.conf.org

# Disable UserDir
mv /etc/httpd/conf.d/userdir.conf /etc/httpd/conf.d/userdir.conf.org

# Document root
mkdir -p /var/www/html/sample1

echo "sample1 $(uname -n)" > /var/www/html/sample1/index.html

systemctl enable --now httpd

# SELinux
setsebool -P httpd_can_network_connect=true
