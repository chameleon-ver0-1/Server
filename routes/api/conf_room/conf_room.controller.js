const model = require('../../../models');
const model_mg = require('../../../models_mg');
require("dotenv").config({
    path: __dirname + "\\" + ".env"
});

//201 - 성공 / 202 - 실패같은성공 / 400 - 잘못된 요청

//개설 버튼 눌렀을 때
/*
    POST /api/conf_room/create/:projectId
    {
        title
        members
        mainTopics
        startTime(날짜 +시간 )
    }
*/
exports.create = (req, res, next) => {
    //id 제외 총 7개 속성 갖고있음
    var title; //방 제목
    var members; // 참여자
    var mainTopics; //메인 토픽
    var startTime; // 시작 시간
    var organizerEmail; //회의 개설자 이메일
    var projectId;
    try {
        projectId = req.params.projectId;
        title = req.body.title;
        mainTopics = req.body.mainTopics;
        members = req.body.members;
        startTime = req.body.startTime;
        organizerEmail = req.user.email;
        members.push(organizerEmail);
    } catch (err) {
        console.log(err);
        res.status(400).json({
            message: 'Please check Params',
            data: false
        });
    }
    // console.log(members);

    model_mg.Conf_room.findOne({
        title: title,
        projectId: projectId
    }).then((result) => {
        if (result) {
            res.status(202).json({
                message: '회의 제목 중복',
                data: false
            });
        } else {
            //TODO: model_mg.Conf_room.create에 7개 데이터 insert 하기 
            model_mg.Conf_room.create({
                title: title,
                members: members,
                startTime: startTime,
                mainTopics: mainTopics,
                projectId: projectId
            }).then(async (result) => {
                if (!result) {
                    res.status(202).json({
                        message: '회의실 생성 실패',
                        data: false
                    });
                } else {
                    await members.forEach(member => {
                        console.log(member);

                        model.ConfUser.create({
                            confTitle: title,
                            projectId: projectId,
                            email: member,
                            isAdminYn: "N",
                            isConfYn: "N",
                            createdAt: new Date().getTime(),
                            updatedAt: new Date().getTime()
                        }).catch((err) => {
                            console.log(err);
                            res.status(500).json({
                                message: '서버 오류',
                                data: false
                            });
                        });
                    });
                    //conf_user 테이블에 추가
                    await model.ConfUser.update({
                        isAdminYn: "Y"
                    }, {
                        where: {
                            email: organizerEmail,
                            projectId: projectId,
                            confTitle: title
                        }
                    }).then((result) => {
                        if (result) {
                            res.status(201).json({
                                message: '회의실 생성 성공',
                                data: {
                                    title: title,
                                    members: members,
                                    confLeader: organizerEmail,
                                    startTime: startTime,
                                    mainTopics: mainTopics,
                                    projectId: projectId
                                }
                            });
                        } else {
                            res.status(202).json({
                                message: '회의실 생성 실패',
                                data: false
                            });
                        }
                    });
                }
            });
        }
    }).catch((err) => {
        console.log(err);
        res.status(500).json({
            message: '서버 오류',
            data: false
        });
    });

};

//TODO: 이름 누르고 엔터쳤을 때 사용자의 부서와 이메일 넘겨주기 --> 참여자 추가 확인
/*
    POST /api/conf_room/memberCheck/:projectId
    {
        userName
    }
*/
exports.memberCheck = async (req, res, next) => {
    var projectId;
    var projectName;
    var mamberName;
    var organizerEmail;
    var roleExist = true;
    //유저 
    //결과값 돌려줄 객체 배열 만들어야함
    var searchList = [];
    try {
        projectId = req.params.projectId;
        mamberName = req.body.userName; // 확인받을 회의참여자 이름
        organizerEmail = req.user.email;
    } catch (err) {
        console.log(err);
        res.status(400).json({
            message: 'Please check Params',
            data: false
        });
    }
    await model_mg.Project.findOne({
        _id: projectId
    }).then((result) => {
        if (result) {
            projectName = result.name;
            console.log(result.roles);

            if (!result.roles) {
                roleExist = false;
            }
        } else {
            res.status(400).json({
                message: '없는 프로젝트',
                data: false
            });
        }
    }).catch((err) => {
        console.log(err);
        res.status(500).json({
            message: '서버 오류',
            data: false
        });
    });
    //동명이인이 있을 수 있기 때문 findAll
    await model.User.findAll({
        where: {
            name: mamberName
        }
    }).then((result) => {
        // console.log(result.length);
        if (result) {
            //프로젝트에 있고 부서 설정이 되어있는 member만 가져오기
            var total = result.length;
            var i = 0;
            // console.log(total);
            result.forEach((data) => {
                // console.log(data.email);
                if (data.email === organizerEmail) {
                    // console.log(organizerEmail);
                    i = i + 1;
                } else {
                    model.ProjectUser.findOne({
                        where: {
                            projectName: projectName,
                            email: data.email
                        }
                    }).then((result) => {
                        // console.log(result.email);
                        if (result) {
                            if (result.projectRole || roleExist === false) {
                                var member = {};
                                member.email = result.email;
                                member.role = result.projectRole;
                                searchList.push(member);
                                console.log(searchList);
                                i = i + 1;
                            } else {
                                i = i + 1;
                            }
                        } else {
                            i = i + 1;
                        }
                        if (i === total) {
                            // console.log(i);
                            res.status(201).json({
                                message: '검색 결과',
                                data: {
                                    searchList
                                }
                            });
                        }
                    });
                }
            });
        } else {
            res.status(400).json({
                message: '없는 사용자',
                data: false
            });
        }
    }).catch((err) => {
        console.log(err);
        res.status(500).json({
            message: '서버 오류',
            data: false
        });
    });
};

/*
    GET /api/conf_room/proceedList/:projectId
    {
    }
*/
exports.proceedList = (req, res, next) => {
    //TODO: 현재시간을 기준으로 끝나는시간이 null이고 시작시간이 현재시간보다 이전인 것에 해당하는 회의실 목록만 보여주기
    console.log(new Date().getTime());

};

/*
    GET /api/conf_room/includedList/:projectId
    {
    }
*/
exports.includedList = async (req, res, next) => {
    //TODO: conf_room에서 endTime이 없고 참여자이름중 나의 이메일이 있는 회의실 목록 가져오기
    //Date비교(현재시간과 body startTime비교)
    var projectId;
    var myEmail;
    var confTitles = [];
    var confMember; //참여중인 멤버 수
    var resultData = [];
    var confRoomData = []; //회의이름, 개설자, 참여중인 사람 수 

    try {
        projectId = req.params.projectId;
        startTime = req.body.startTime;
        myEmail = req.user.email;
    } catch (err) {
        console.log(err);
        res.status(400).json({
            message: 'Please check Params',
            data: false
        });
    }

    //나를 포함하는 회의실 찾기
    await model_mg.Conf_room.find({
        members: {
            $in: [myEmail]
        },
        projectId: projectId
    }).then((results) => {
        if (results) {
            console.log(results.length);
            var i = 0;
            if(results.length===0){
                res.status(202).json({
                    message: '결과 없음',
                    data: []
                });
            }
            results.forEach(async(result) => {
                if (result.startTime > new Date().getTime()) {
                    var confYEmail = [];
                    await model.ConfUser.findAll({
                        where: {
                            projectId: projectId,
                            confTitle: result.title,
                            isConfYn: "Y"
                        }
                    }).then((result) => {
                        // console.log(result);
                        if (result) {
                            result.forEach((data) => {
                                confYEmail.push(data.email);
                            });
                        }
                    });
                    //예정된 회의실 찾음
                    await model.ConfUser.findOne({
                        where: {
                            confTitle: result.title,
                            isAdminYn: "Y"
                        }
                    }).then((data) => {
                        model.User.findOne({
                            where: {
                                email: data.email
                            }
                        }).then((data) => {
                            i = i + 1;
                            resultData.push({
                                startTime: result.startTime,
                                id:result._id, 
                                title: result.title,
                                members: result.members,
                                membersTotal: result.members.length,
                                isConfYMembers : confYEmail,
                                isConfYMembersTotal : confYEmail.length,
                                adminEmail: data.name
                            });

                            if (i === results.length) {
                                console.log(i);
                                res.status(200).json({
                                    message: '내가 포함된 회의 목록 조회 성공',
                                    data: resultData
                                });
                            }
                        });
                    });
                } else {
                    i = i + 1;
                }
            });
        } else {
            res.status(202).json({
                message: '결과 없음',
                data: false
            });
        }
    }).catch((err) => {
        console.log(err);
        res.status(500).json({
            message: '서버 오류',
            data: false
        });
    });
};

/*
    GET /api/conf_room/enterConf/:projectId/:confId
    {
    }
*/
//TODO: 회의실에 들어갈때 conf_user에 isConfYn 바꾸는 작업 필요(N-->Y))
exports.enterConf = async(req, res, next) => {
    var confId;
    var projectId;
    var confTitle;
    var mainTopics;
    var members;
    var startTime;
    var email;
    var title;
    var confLeaderEmail;
    try {
        confId = req.params.confId;
        projectId = req.params.projectId;
        email = req.user.email;
    } catch (error) {
        console.log(err);
        res.status(400).json({
            message: 'Please check Params',
            data: false
        });
    }

    await model_mg.Conf_room.findOne({
        _id: confId
    }).then(async(result) => {
        if(!result){
            res.status(400).json({
                message: '없는 회의실',
                data: false
            });
        }
        title = result.title;
        await model.ConfUser.findOne({
            where : {
                email : email,
                confTitle : title
            }
        }).then((data)=>{
            console.log(data.isConfYn);
            
            if(data){
                if(data.isConfYn == 'Y'){
                    res.status(202).json({
                        message: '회의 참여중인 사용자',
                        data: false
                    });
                }
            }
        });
        await model.ConfUser.findOne({
            where : {
                confTitle : title,
                isAdminYn : "Y"
            }
        }).then((data)=>{
            if(!data){
                res.status(202).json({
                    message: '개설자 없음',
                    data: false
                });
            }
            console.log(data.email);
            confLeaderEmail = data.email;   
        }); 
    });

    await model_mg.Conf_room.findOne({
        _id: confId
    }).then((result) => {
        if (result) {
            mainTopics = result.mainTopics;
            confTitle = result.title;
            members = result.members;
            startTime = result.startTime;
            model.ConfUser.update({
                isConfYn: "Y"
            }, {
                where: {
                    email: req.user.email,
                    projectId: projectId,
                    confTitle: confTitle
                }
            }).then((result) => {
                if (result) {
                    console.log(confTitle);

                    model.ConfUser.findAll({
                        where: {
                            projectId: projectId,
                            confTitle: confTitle,
                            isConfYn: "Y"
                        }
                    }).then((result) => {
                        // console.log(result);
                        if (result) {
                            var email = [];
                            result.forEach((data) => {
                                email.push(data.email);
                            });

                            res.status(201).json({
                                message: '회의실 들어감(update성공)',
                                data: {
                                    confId : confId,
                                    confTitle: confTitle,
                                    mainTopics: mainTopics,
                                    members: members,
                                    isConfMemberCount: result.length,
                                    isConfMember: email,
                                    confLeader: confLeaderEmail,
                                    startTime: startTime
                                }
                            });
                        } else {
                            res.status(202).json({
                                message: 'update실패',
                                data: false
                            });
                        }
                    });
                } else {
                    res.status(500).json({
                        message: '업데이트 실패',
                        data: false
                    });
                }
            });
        } else {
            res.status(400).json({
                message: '해당하는 회의실이 존재하지 않음(confId 문제)',
                data: false
            });
        }
    }).catch((err) => {
        console.log(err);

        res.status(500).json({
            message: '서버 오류',
            data: false
        });
    });
};

/*
    GET /api/conf_room/memberList/:projectId/:confId
    {
    }
*/
//FIXME: 동그라미에서 3/4 누르면 회의 참여자들 목록 보여주기
exports.memberList = (req, res, next) => {
    var confId;
    var members = [];
    try {
        confId = req.params.confId;
    } catch (err) {
        console.log(err);
        res.status(400).json({
            message: 'Please check Params',
            data: false
        });
    }

    model_mg.Conf_room.findOne({
        _id: confId
    }).then((result) => {
        if (result) {
            // console.log(result);
            result.members.forEach((member) => {
                var memberObject = {};
                memberObject.member = member;
                members.push(memberObject);
            });
            res.status(201).json({
                message: '참여자 목록',
                data: members
            });
        } else {
            res.status(202).json({
                message: '없는 회의',
                data: false
            });
        }
    }).catch((err) => {
        console.log(err);
        res.status(500).json({
            message: '서버 오류',
            data: false
        });
    });
};

/*
    GET /api/conf_room/exitConf/:projectId/:confId
    {
    }
*/
//TODO: 회의 종료 API --> 상태변경 및 회의록 데이터 생성
exports.exitConf = (req, res, next) => {
    var confId;
    var projectId;
    var userEmail;
    try {
        projectId = req.params.projectId;
        confId = req.params.confId;
        userEmail = req.user.email;
    } catch (err) {
        console.log(err);
        res.status(400).json({
            message: 'Please check Params',
            data : false
        });
    }

    //TODO: 상태변경

};