import React, { useState, useRef, useEffect } from 'react';
import { Printer, FileText, Users, Calendar, Settings, Upload, Wand2, Loader2, Download, CloudUpload, Mail, Send, X, FileDown, Lock, Eye, EyeOff, GraduationCap, UserPlus, ChevronLeft } from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";

let ai: GoogleGenAI | null = null;
try {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    ai = new GoogleGenAI({ apiKey });
  } else {
    console.warn("GEMINI_API_KEY is not set. AI features will be disabled.");
  }
} catch (e) {
  console.error("Failed to initialize GoogleGenAI:", e);
}

// --- 타입 정의 ---
export interface WeekData {
  weekNumber: number;
  date: string;
  image: string;
  toolName: string;
  musicGymnastics: string;
  singAlong: string;
  playingActivity: string;
  goal: string;
  expectedEffect: string;
  journalGoal: string;
  evaluation: string;
  isGenerating?: boolean;
}

export interface Instructor {
  id: string;
  name: string;
  phone1: string;
  phone2: string;
  phone3: string;
  weeks?: WeekData[];
}

const subjectLabels: Record<string, { singAlong: string, playingActivity: string }> = {
  '음악': { singAlong: '노래회상', playingActivity: '연주활동' },
  '체조': { singAlong: '체조수업', playingActivity: '도구게임' },
  '전래': { singAlong: '전래동화', playingActivity: '신체놀이' },
  '교구': { singAlong: '인지활동', playingActivity: '교구활동' },
  '노래': { singAlong: '노래회상', playingActivity: '오늘의노래' },
};

const getLabels = (subject: string) => {
  return subjectLabels[subject] || subjectLabels['음악'];
};

const getWeekRange = (year: number, monthStr: string, weekIndex: number) => {
  const month = parseInt(monthStr, 10);
  if (isNaN(month) || month < 1 || month > 12) return "";
  
  let d = new Date(year, month - 1, 1);
  while (d.getDay() !== 1) {
    d.setDate(d.getDate() + 1);
  }
  
  let mondayObj = new Date(year, month - 1, d.getDate() + (weekIndex * 7));
  let saturdayObj = new Date(year, month - 1, d.getDate() + (weekIndex * 7) + 5);
  
  const firstDayOfMonth = new Date(year, month - 1, 1);
  const lastDayOfMonth = new Date(year, month, 0);

  // 1주차(첫 주차)인 경우 무조건 해당 월의 1일로 맞춤
  if (weekIndex === 0) {
    mondayObj = firstDayOfMonth;
  } else if (mondayObj.getTime() < firstDayOfMonth.getTime()) {
    mondayObj = firstDayOfMonth;
  } else if (mondayObj.getTime() > lastDayOfMonth.getTime()) {
    mondayObj = lastDayOfMonth;
  }

  // 4주차(마지막 주차)인 경우 무조건 해당 월의 마지막 날짜로 맞춤
  if (weekIndex === 3) {
    saturdayObj = lastDayOfMonth;
  } else if (saturdayObj.getTime() > lastDayOfMonth.getTime()) {
    saturdayObj = lastDayOfMonth;
  } else if (saturdayObj.getTime() < firstDayOfMonth.getTime()) {
    saturdayObj = firstDayOfMonth;
  }
  
  let m1 = mondayObj.getMonth() + 1;
  let d1 = mondayObj.getDate();
  let m2 = saturdayObj.getMonth() + 1;
  let d2 = saturdayObj.getDate();
  
  if (m1 === m2) {
    return `${year}년 ${month}월 ${weekIndex + 1}주차(${d1}~${d2}일)`;
  } else {
    return `${year}년 ${month}월 ${weekIndex + 1}주차(${m1}/${d1}~${m2}/${d2})`;
  }
};

export interface AppData {
  year: string;
  month: string;
  subject: string;
  musicGymnastics: string;
  instructors: Instructor[];
  weeks: WeekData[];
  planTemplateId?: string;
  journalTemplateId?: string;
}

const categoryTemplates: Record<string, { plan: string, journal: string }> = {
  '음악': {
    plan: '1R_GNnJl0ExMF5OUZBvApNwS_cx9bGYLFLvWX76fIqGE',
    journal: '1UcT_2C5lCsUVo2UgvPoxYNLl5mCWGQFrioLd27a-vuk'
  },
  '체조': {
    plan: '1PGWrwMQPhsa4IKnk75doYz_KKXJtghLWjVlyCmhahn8',
    journal: '1hmNy5nn90NHg9Zbkk8J3BRiCw4_JkrYsoaOhMPojIA0'
  },
  '전래': {
    plan: '17scDDJAfKiWvSowq61VqCDyofUQS-IUYpYyeWxIAHro',
    journal: '1E2dPNAXhaVlV9sde7kE_Mtzh8iKca49f24nxhFfrc0A'
  },
  '교구': {
    plan: '1f9yuWrJxWb09h6yOfuguag1b5XMEAZslVGe-S8wy3Ks',
    journal: '1CyOiKRKVw7mLjUALTzVU7SZCoECSIOwKc37DuVStUdU'
  },
  '노래': {
    plan: '1MqenR4RTwfUo9cq8Y27pLyqRmOni49lgxfGuHXJKByM',
    journal: '1qZwuNffa7GXsd_iVk9QLWNIaBCqziY5XusFlpQqwC2E'
  }
};

// --- 기본 데이터 (테스트 및 초기화용) ---
const defaultData: AppData = {
  year: new Date().getFullYear().toString(),
  month: "02",
  subject: "음악",
  musicGymnastics: "음악체조",
  planTemplateId: categoryTemplates['음악'].plan,
  journalTemplateId: categoryTemplates['음악'].journal,
  instructors: [
    { id: "1", name: "김미희", phone1: "010-8971-4304", phone2: "", phone3: "" },
    { id: "2", name: "이영희", phone1: "010-8411-4406", phone2: "", phone3: "" },
    { id: "3", name: "박철수", phone1: "010-1234-5678", phone2: "", phone3: "" },
    { id: "4", name: "최민수", phone1: "010-9876-5432", phone2: "", phone3: "" },
  ],
  weeks: [
    {
      weekNumber: 1,
      date: "2026년 2월 1주차(2~7일)",
      image: "https://images.unsplash.com/photo-1519892300165-cb5542fb47c7?w=150&h=150&fit=crop",
      toolName: "막대탬버린",
      musicGymnastics: "개나리처녀",
      singAlong: "비내리는 영동교",
      playingActivity: "부초같은인생, 아모르파티",
      goal: "막대 손잡이를 한 손으로 잡고 좌우 또는 위아래로 흔들어 소리를 만들어 본다. 리듬에 맞춰 속도와 강도를 조절하며 신나는 노래에 맞춰 몸을 함께 흔들며 즐겁게 연주해 본다.",
      expectedEffect: "소리의 크기와 울림의 차이를 구분하며 박자와 리듬 패턴을 인식하는 능력이 향상되고, 손목과 손가락을 사용한 흔들기·두드리기 동작을 통해 소근육 사용 빈도가 증가하며 상지 움직임이 활성화된다.",
      journalGoal: "막대 손잡이를 한 손으로 잡고 좌우 또는 위아래로 흔들어 소리를 만들어 본다. 리듬에 맞춰 속도와 강도를 조절하며 신나는 노래에 맞춰 몸을 함께 흔들며 즐겁게 연주해 본다.",
      evaluation: "어르신들은 다양한 소리를 탐색하는 활동에 흥미를 보이며 적극적으로 참여하였다.\n소리의 크기와 울림의 차이를 구분하는 과정에서 박자와 리듬 패턴에 대한 인식 능력이 자연스럽게 향상되었다.\n들리는 소리에 맞춰 반응하며 청각적 집중력과 리듬 이해도가 안정적으로 유지되었다.\n손목과 손가락을 활용한 흔들기와 두드리기 동작을 반복하며 소근육 사용 빈도가 증가하였다.\n상지 움직임이 활발해지며 신체 활동에 대한 참여 의욕도 함께 높아졌다.\n활동이 진행될수록 동작과 소리의 일치도가 향상되는 모습이 관찰되었다.\n전반적으로 청각 인지 능력과 소근육 활성화가 함께 이루어진 의미 있는 음악 활동으로 평가된다."
    },
    {
      weekNumber: 2,
      date: "2026년 2월 2주차(9~14일)",
      image: "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=150&h=150&fit=crop",
      toolName: "원반드럼",
      musicGymnastics: "개나리처녀",
      singAlong: "님과함께",
      playingActivity: "노래하며춤추며, 멋진인생",
      goal: "한 손으로 드럼의 가장자리를 잡고 중앙을 부드럽게 두드려 기본 박자를 만들어 본다. 두드리는 힘을 달리하여 강박과 약박을 표현하고, 소리의 크기 차이를 인지하며 연주해 본다.",
      expectedEffect: "반복적인 박자 연주를 통해 리듬 구조를 이해하고 청각적 인식 능력이 향상되며, 두드리는 위치와 힘을 조절하는 과정에서 시각·운동 협응 능력과 정확성이 강화된다.",
      journalGoal: "한 손으로 드럼의 가장자리를 잡고 중앙을 부드럽게 두드려 기본 박자를 만들어 본다. 두드리는 힘을 달리하여 강박과 약박을 표현하고, 소리의 크기 차이를 인지하며 연주해 본다.",
      evaluation: "드럼의 중앙을 두드리며 기본 박자를 만들어내는 과정에서 리듬감이 향상되었다.\n강박과 약박을 표현하며 소리의 크기 차이를 인지하고 조절하는 능력이 관찰되었다.\n반복적인 연주를 통해 청각적 집중력이 유지되었으며, 시각과 운동의 협응 능력이 강화되었다.\n어르신들이 활동에 즐겁게 참여하며 정서적 안정감을 느끼는 모습이 보였다."
    },
    {
      weekNumber: 3,
      date: "2026년 2월 3주차(16~21일)",
      image: "https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=150&h=150&fit=crop",
      toolName: "우드레칫",
      musicGymnastics: "개나리처녀",
      singAlong: "꿈에본내고향",
      playingActivity: "빨간구두아가씨, 그대여변치마오",
      goal: "손잡이를 한 손으로 잡은 후 손목을 앞뒤 또는 위아래로 가볍게 흔들어 소리를 만들어 본다. 흔드는 속도에 따라 빠르기와 리듬을 조절하며 연주해 본다.",
      expectedEffect: "손목 움직임에 따라 발생하는 연속적인 소리를 들으며 빠르기와 박자의 변화를 인지하고, 일정한 리듬을 유지하며 연주함으로써 청각적 집중력과 리듬 감각이 향상된다.",
      journalGoal: "손잡이를 한 손으로 잡은 후 손목을 앞뒤 또는 위아래로 가볍게 흔들어 소리를 만들어 본다. 흔드는 속도에 따라 빠르기와 리듬을 조절하며 연주해 본다.",
      evaluation: "손목을 활용하여 소리를 만들어내는 과정에서 소근육 조절 능력이 향상되었다.\n흔드는 속도에 따른 빠르기와 리듬의 변화를 인지하고 적극적으로 표현하였다.\n연속적인 소리에 집중하며 청각적 반응 속도가 개선되는 모습이 관찰되었다.\n일정한 리듬을 유지하려는 노력을 통해 집중력과 리듬 감각이 강화되었다."
    },
    {
      weekNumber: 4,
      date: "2026년 2월 4주차(23~28일)",
      image: "https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=150&h=150&fit=crop",
      toolName: "핑거심벌즈",
      musicGymnastics: "개나리처녀",
      singAlong: "청춘의꿈",
      playingActivity: "있을때잘해, 엄지척",
      goal: "양손에 각각 하나씩 악기를 잡고 가볍게 맞부딪혀 소리를 내며, 힘 조절에 따라 소리의 크기를 다르게 표현해 본다. 강사의 손 신호나 구호에 따라 연주를 시작하거나 멈추며 집중력 활동으로 확장해 본다.",
      expectedEffect: "손가락, 손목, 전완 근육 사용이 증가하고 양손 협응 능력이 향상되며, 신호에 맞춰 연주를 조절하는 과정에서 집중력과 반응 속도가 향상되어 인지 기능을 자극한다.",
      journalGoal: "양손에 각각 하나씩 악기를 잡고 가볍게 맞부딪혀 소리를 내며, 힘 조절에 따라 소리의 크기를 다르게 표현해 본다. 강사의 손 신호나 구호에 따라 연주를 시작하거나 멈추며 집중력 활동으로 확장해 본다.",
      evaluation: "양손을 사용하여 악기를 맞부딪히는 활동을 통해 양손 협응 능력이 향상되었다.\n힘 조절을 통해 소리의 크기를 다르게 표현하며 미세한 근육 조절 능력이 관찰되었다.\n강사의 신호에 맞춰 연주를 시작하고 멈추는 과정에서 집중력과 반응 속도가 개선되었다.\n다양한 소리 표현을 통해 인지 기능이 자극되며 활동에 대한 만족도가 높게 나타났다."
    }
  ]
};

// --- 계획안 템플릿 컴포넌트 ---
const PlanTemplate = ({ data, instructor }: { data: AppData, instructor: Instructor, key?: string | number }) => {
  const phones = [instructor.phone1, instructor.phone2, instructor.phone3].filter(Boolean).join(' / ');
  const labels = getLabels(data.subject);
  return (
    <div className="page-break w-full bg-white p-8 mx-auto font-sans" style={{ width: '297mm', minHeight: '210mm' }}>
      <div className="text-right mb-2">
        <h2 className="text-xl font-bold text-blue-900 border-b-2 border-blue-900 inline-block pb-1">장고교육개발원</h2>
      </div>
      
      <table className="w-full border-collapse border-2 border-blue-600 text-sm text-center">
        <thead>
          <tr>
            <th colSpan={5} className="bg-blue-600 text-white text-2xl py-4 font-bold border border-blue-600">
              {data.month}월 {data.subject} 계획안
            </th>
          </tr>
          <tr className="bg-blue-600 text-white font-bold">
            <th className="py-2 border border-blue-600 w-24">강사</th>
            <th className="py-2 border border-blue-600 w-1/4">{instructor.name}</th>
            <th className="py-2 border border-blue-600 w-1/4">긴급연락망</th>
            <th colSpan={2} className="py-2 border border-blue-600 whitespace-pre-wrap">{phones}</th>
          </tr>
          <tr className="bg-blue-600 text-white font-bold">
            <th className="py-2 border border-blue-600">차수</th>
            <th className="py-2 border border-blue-600">교구</th>
            <th className="py-2 border border-blue-600">수업활동</th>
            <th className="py-2 border border-blue-600">목표</th>
            <th className="py-2 border border-blue-600">기대효과</th>
          </tr>
        </thead>
        <tbody>
          {data.weeks.map((week, idx) => (
            <tr key={idx}>
              <td className="py-4 border border-blue-600 font-bold bg-blue-600 text-white">{week.weekNumber}주</td>
              <td className="p-2 border border-blue-600">
                <div className="flex flex-col items-center gap-2">
                  {week.image ? (
                    <img src={week.image} alt={week.toolName} className="w-24 h-24 object-contain" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-24 h-24 bg-gray-100 flex items-center justify-center text-gray-400 text-xs border">이미지</div>
                  )}
                  <span className="font-medium">{week.toolName}</span>
                </div>
              </td>
              <td className="p-2 border border-blue-600 text-center text-xs leading-relaxed">
                <p><span className="font-bold text-blue-800">*음악체조-</span><br/>{week.musicGymnastics}</p>
                <p className="mt-2"><span className="font-bold text-blue-800">*{labels.singAlong}-</span><br/>{week.singAlong}</p>
                <p className="mt-2"><span className="font-bold text-blue-800">*{labels.playingActivity}</span><br/>{week.playingActivity}</p>
              </td>
              <td className="p-4 border border-blue-600 text-center text-xs leading-relaxed whitespace-pre-wrap">
                {week.goal}
              </td>
              <td className="p-4 border border-blue-600 text-center text-xs leading-relaxed whitespace-pre-wrap">
                {week.expectedEffect}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-center mt-4 font-bold text-lg">
        ★계획안의 내용은 변동 될 수 있습니다★
      </div>
    </div>
  );
};

// --- 일지 템플릿 컴포넌트 ---
const JournalTemplate = ({ data, instructor, week }: { data: AppData, instructor: Instructor, week: WeekData, key?: string | number }) => {
  const labels = getLabels(data.subject);
  return (
    <div className="page-break w-full bg-white p-8 mx-auto font-sans" style={{ width: '210mm', minHeight: '297mm' }}>
      <div className="flex justify-between items-start mb-4">
        <h1 className="text-2xl font-bold border-2 border-black px-4 py-2 flex items-center gap-2">
          <span className="w-4 h-4 bg-black inline-block"></span>
          프로그램 제공기록 작성
        </h1>
        <table className="border-collapse border border-black text-sm text-center w-48">
          <tbody>
            <tr>
              <td className="border border-black bg-gray-100 py-1 w-1/2">담당</td>
              <td className="border border-black bg-gray-100 py-1 w-1/2">원장</td>
            </tr>
            <tr>
              <td className="border border-black h-16"></td>
              <td className="border border-black h-16"></td>
            </tr>
          </tbody>
        </table>
      </div>

      <table className="w-full border-collapse border border-black text-sm">
        <tbody>
          <tr>
            <th className="border border-black bg-gray-100 py-2 w-32">제공일시<span className="text-red-500">*</span></th>
            <td colSpan={3} className="border border-black px-4 py-2">{week.date}</td>
          </tr>
          <tr>
            <th className="border border-black bg-gray-100 py-2">프로그램<span className="text-red-500">*</span></th>
            <td className="border border-black px-4 py-2 w-1/3">{data.subject}</td>
            <th className="border border-black bg-gray-100 py-2 w-32">수급자 그룹</th>
            <td className="border border-black px-4 py-2">수급자</td>
          </tr>
          <tr>
            <th className="border border-black bg-gray-100 py-2">진행자명<span className="text-red-500">*</span></th>
            <td className="border border-black px-4 py-2">{instructor.name} 강사</td>
            <th className="border border-black bg-gray-100 py-2">프로그램 유형</th>
            <td className="border border-black px-4 py-2">인지활동/신체활동</td>
          </tr>
          <tr>
            <th className="border border-black bg-gray-100 py-2">장소<span className="text-red-500">*</span></th>
            <td className="border border-black px-4 py-2">프로그램실</td>
            <th className="border border-black bg-gray-100 py-2">참여자 / 현원</th>
            <td className="border border-black px-4 py-2">00/00(100%)</td>
          </tr>
          
          <tr>
            <th className="border border-black bg-gray-100 py-4">준비물</th>
            <td className="border border-black p-4 text-center">
              {week.image ? (
                <img src={week.image} alt={week.toolName} className="w-24 h-24 object-contain mx-auto" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-24 h-24 bg-gray-100 flex items-center justify-center text-gray-400 text-xs border mx-auto">이미지</div>
              )}
            </td>
            <td colSpan={2} className="border border-black px-4 py-2 text-center font-bold">
              {week.toolName}, 마이크, 스피커, 이어마이크, TV
            </td>
          </tr>

          <tr>
            <th rowSpan={3} className="border border-black bg-gray-100 py-2">활동수준</th>
            <th className="border border-black bg-gray-100 py-1 w-20 text-center">1수준</th>
            <td colSpan={2} className="border border-black px-4 py-1">노래를 불러본다.</td>
          </tr>
          <tr>
            <th className="border border-black bg-gray-100 py-1 text-center">2수준</th>
            <td colSpan={2} className="border border-black px-4 py-1">노래를 부르며 악기를 두드려본다.</td>
          </tr>
          <tr>
            <th className="border border-black bg-gray-100 py-1 text-center">3수준</th>
            <td colSpan={2} className="border border-black px-4 py-1">노래를 부르며 악기를 두드리고 창의적인 연주를 해본다.</td>
          </tr>

          <tr>
            <th className="border border-black bg-gray-100 py-4">목표</th>
            <td colSpan={3} className="border border-black px-4 py-4 whitespace-pre-wrap leading-relaxed">
              {week.journalGoal}
            </td>
          </tr>

          <tr>
            <th className="border border-black bg-gray-100 py-4">
              프로그램<br/>내용<span className="text-red-500">*</span><br/>
              <span className="font-normal text-xs">(진행과정)</span>
            </th>
            <td colSpan={3} className="border border-black px-4 py-4 leading-relaxed">
              <p className="font-bold">■도입 : 인사</p>
              <p>- 어르신과 인사를 한 후 오늘의 날짜와 요일, 시간에 관해 질문하며 지남력 훈련을 한다.</p>
              <p>- 신나는 노래를 이용하여 인사한다.</p>
              <p>- 스트레칭 후 건강 운동으로 근육 운동을 한다.</p>
              
              <p className="font-bold mt-3">■전개 : 음악체조, {labels.singAlong}</p>
              <p>- 음악체조(<span className="font-bold">{data.musicGymnastics}</span>)를 한다.</p>
              <p>- {labels.singAlong}(<span className="font-bold">{week.singAlong}</span>)을(를) 한다.</p>
              
              <p className="font-bold mt-3">■전개 : {labels.playingActivity}</p>
              <p>- <span className="font-bold">{week.toolName}</span>을 탐색해본다.(모양, 색, 크기)</p>
              <p>- {labels.playingActivity}(<span className="font-bold">{week.playingActivity}</span>)을(를) 한다.</p>
              <p>- {labels.playingActivity} 창의적인 활동을 해본다.</p>
              
              <p className="font-bold mt-3">■마무리 : 인사</p>
              <p>- 악기연주로 피로해진 근육을 스트레칭한다.</p>
              <p>- 이번 주 음악을 배워보고 노래와 율동을 한 후, 수업을 마무리한다.</p>
            </td>
          </tr>

          <tr>
            <th className="border border-black bg-gray-100 py-4">
              전반적 평가<br/>
              <span className="font-normal text-xs">(모니터링)</span>
            </th>
            <td colSpan={3} className="border border-black px-4 py-4 whitespace-pre-wrap leading-relaxed text-justify">
              {week.evaluation}
            </td>
          </tr>
        </tbody>
      </table>
      <div className="text-center mt-4 font-bold text-red-500 text-sm">
        * 본 일지는 참고용 입니다.
      </div>
    </div>
  );
};

// --- 로그인 페이지 컴포넌트 ---
function LoginPage({ onLogin, onNavigateToSignup }: { onLogin: (email: string) => void, onNavigateToSignup: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      alert('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      // 임시 우회: 앱 스크립트 연결 문제 해결 전까지 특정 아이디/비밀번호로 무조건 로그인 허용
      if (email === 'admin' && password === '1234') {
        onLogin(email);
        return;
      }

      const scriptUrl = "https://script.google.com/macros/s/AKfycbzkGgdRY1G_t1C0MQHpwHlvaZ0k0ZrEkGECfFtwGtR75-3RVsse1nubuktGXpru0jtP/exec";
      const response = await fetch(`${scriptUrl}?action=checkLogin&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const text = await response.text();
      
      try {
        const result = JSON.parse(text);
        if (result.status === 'success') {
          if (result.isAuthorized) {
            onLogin(email);
          } else {
            alert(result.message || '관리자 승인 대기 중이거나 정보가 일치하지 않습니다.');
          }
        } else {
          alert(`로그인 오류: ${result.message}`);
        }
      } catch (e) {
        console.error("JSON parse error:", text);
        alert('서버 응답을 처리할 수 없습니다. 구글 앱스 스크립트 배포 URL이 정확한지 확인해주세요.');
      }
    } catch (e) {
      console.error("Login check error:", e);
      alert('로그인 처리 중 네트워크 오류가 발생했습니다.\n(CORS 문제일 수 있습니다. 구글 앱스 스크립트 배포 설정을 확인해주세요.)');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cover bg-center relative" style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1497366216548-37526070297c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80")' }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
      
      <div className="relative z-10 bg-white/90 backdrop-blur-md p-10 rounded-3xl shadow-2xl w-full max-w-md border border-white/20">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-blue-600 p-4 rounded-2xl mb-4 shadow-lg">
            <GraduationCap size={40} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">장고교육개발원</h1>
          <p className="text-sm text-gray-500 font-medium">일지, 계획안, 이메일 자동화 프로그램</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">이메일</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail size={18} className="text-gray-400" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/50"
                placeholder="이메일을 입력하세요"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">비밀번호</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock size={18} className="text-gray-400" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/50"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                {showPassword ? (
                  <EyeOff size={18} className="text-gray-400 hover:text-gray-600" />
                ) : (
                  <Eye size={18} className="text-gray-400 hover:text-gray-600" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3.5 rounded-xl font-semibold text-lg hover:bg-blue-700 transition-colors shadow-md mt-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? <Loader2 size={24} className="animate-spin" /> : null}
            {isLoading ? '확인 중...' : '로그인'}
          </button>

          <button
            type="button"
            onClick={onNavigateToSignup}
            className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-200 transition-colors"
          >
            <UserPlus size={18} />
            신규 회원가입 신청
          </button>
        </form>
        
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500">© 2026 Janggo Education Dev Institute.</p>
        </div>
      </div>
    </div>
  );
}

// --- 회원가입 페이지 컴포넌트 ---
function SignupPage({ onNavigateToLogin }: { onNavigateToLogin: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    department: '',
    branch: '',
    phone: '',
    address: '',
    joinDate: '',
    role: '강사'
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.password || !formData.phone) {
      alert('필수 항목을 모두 입력해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      const scriptUrl = "https://script.google.com/macros/s/AKfycbzkGgdRY1G_t1C0MQHpwHlvaZ0k0ZrEkGECfFtwGtR75-3RVsse1nubuktGXpru0jtP/exec";
      const response = await fetch(scriptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          action: 'signup',
          data: formData
        }),
      });

      const text = await response.text();
      
      try {
        const result = JSON.parse(text);
        if (result.status === 'success') {
          alert('회원가입 신청이 완료되었습니다.\n관리자 승인 후 로그인할 수 있습니다.');
          onNavigateToLogin();
        } else {
          alert(`회원가입 실패: ${result.message}`);
        }
      } catch (e) {
        console.error("JSON parse error:", text);
        alert('회원가입 처리 중 오류가 발생했습니다.\n(서버 응답 오류)');
      }
    } catch (e) {
      console.error("Signup error:", e);
      alert('회원가입 처리 중 네트워크 오류가 발생했습니다.\n(CORS 문제일 수 있습니다. 구글 앱스 스크립트 배포 설정을 확인해주세요.)');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cover bg-center relative py-10" style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1497366216548-37526070297c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80")' }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
      
      <div className="relative z-10 bg-white/90 backdrop-blur-md p-8 rounded-3xl shadow-2xl w-full max-w-md border border-white/20 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between mb-6">
          <button 
            type="button"
            onClick={onNavigateToLogin}
            className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft size={24} className="text-gray-700" />
          </button>
          <div className="text-right">
            <h2 className="text-blue-600 font-bold text-lg leading-tight">Janggo 2026</h2>
            <p className="text-[10px] text-gray-500 font-semibold tracking-wider">AWAITING APPROVAL</p>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-8">
          <div className="bg-blue-600 p-3 rounded-full shadow-md">
            <UserPlus size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">회원가입 신청</h1>
            <p className="text-xs text-gray-500 font-medium">가입 후 관리자가 승인해야 접속 가능합니다.</p>
          </div>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">이름</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="block w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50/50 text-sm"
              placeholder="실명을 입력하세요"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">이메일 (ID)</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="block w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
              placeholder="example@janggo.com"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">비밀번호</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="block w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
              placeholder="6자 이상 입력하세요"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">부서</label>
            <select
              name="department"
              value={formData.department}
              onChange={handleChange}
              className="block w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50/50 text-sm"
            >
              <option value="">부서 선택</option>
              <option value="음악">음악</option>
              <option value="전래">전래</option>
              <option value="체조">체조</option>
              <option value="교구">교구</option>
              <option value="노래">노래</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">지사</label>
            <select
              name="branch"
              value={formData.branch}
              onChange={handleChange}
              className="block w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50/50 text-sm"
            >
              <option value="">지사 선택</option>
              <option value="천안">천안</option>
              <option value="세종">세종</option>
              <option value="평택">평택</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">전화번호</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="block w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50/50 text-sm"
              placeholder="010-0000-0000"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">주소</label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              className="block w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50/50 text-sm"
              placeholder="거주지 주소를 입력하세요"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">입사일</label>
            <input
              type="date"
              name="joinDate"
              value={formData.joinDate}
              onChange={handleChange}
              className="block w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">등급 (권한)</label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="block w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50/50 text-sm"
            >
              <option value="강사">강사</option>
              <option value="부관리자">부관리자</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-4 rounded-xl font-bold text-base hover:bg-blue-700 transition-colors shadow-md mt-6 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? <Loader2 size={20} className="animate-spin" /> : null}
            {isLoading ? '신청 중...' : '가입 신청하기'}
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <p className="text-[10px] text-gray-500">© 2026 Janggo Education Dev Institute.</p>
        </div>
      </div>
    </div>
  );
}

// --- 메인 앱 컴포넌트 ---
export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loggedInEmail, setLoggedInEmail] = useState('');
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [data, setData] = useState<AppData>(() => {
    const saved = localStorage.getItem('educationAppData');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved data", e);
      }
    }
    return defaultData;
  });
  
  useEffect(() => {
    localStorage.setItem('educationAppData', JSON.stringify(data));
  }, [data]);

  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form');
  const [isSavingToDrive, setIsSavingToDrive] = useState(false);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);

  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const globalPasteIndex = useRef(0);

  const scriptUrl = "https://script.google.com/macros/s/AKfycbyHQopwYIm2n0bdC8BqAL2ipPxj5mVhZWzcuN-W55DrckW9eIDT0NgcRnZ-RafWVxPtvQ/exec";

  // 전역 붙여넣기 이벤트 리스너 (빈 공간 클릭 후 Ctrl+V 시 비어있는 주차에 순서대로 이미지 삽입)
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const activeTag = document.activeElement?.tagName;
      const isInputFocused = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || document.activeElement?.getAttribute('contenteditable') === 'true';
      
      // 개별 이미지 컨테이너에 포커스가 있을 때는 개별 onPaste가 처리하도록 무시
      if (isInputFocused || document.activeElement?.classList.contains('week-image-container')) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              if (event.target?.result) {
                const imgData = event.target.result as string;
                setData(prev => {
                  // 이미지가 없거나, 기본 플레이스홀더(unsplash)인 첫 번째 주차 찾기
                  let targetIdx = prev.weeks.findIndex(w => !w.image || w.image.includes('unsplash.com'));
                  
                  if (targetIdx !== -1) {
                    const newWeeks = [...prev.weeks];
                    newWeeks[targetIdx] = { ...newWeeks[targetIdx], image: imgData };
                    globalPasteIndex.current = (targetIdx + 1) % 4;
                    return { ...prev, weeks: newWeeks };
                  }
                  
                  // 모든 주차에 사용자가 직접 넣은 이미지가 있다면, 순차적으로 덮어쓰기 (1주차부터)
                  const idxToReplace = globalPasteIndex.current;
                  const newWeeks = [...prev.weeks];
                  newWeeks[idxToReplace] = { ...newWeeks[idxToReplace], image: imgData };
                  globalPasteIndex.current = (idxToReplace + 1) % 4;
                  return { ...prev, weeks: newWeeks };
                });
              }
            };
            reader.readAsDataURL(file);
          }
          break; // 이미지 하나만 처리
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, []);

  // 독스 불러오기 (Apps Script 연동)
  const handleLoadDocs = async () => {
    if (!data.month) {
      alert("불러올 월(Month)을 입력해주세요.");
      return;
    }
    setIsLoadingDocs(true);
    try {
      const response = await fetch(`${scriptUrl}?action=load&month=${data.month}&subject=${data.subject}`);
      const text = await response.text();
      
      if (text.includes("App Script is running.")) {
        alert("구글 앱 스크립트가 최신 버전으로 배포되지 않았습니다.\n앱 스크립트 편집기에서 코드를 수정한 후 반드시 '새 배포(New deployment)'를 진행해주세요.");
        return;
      }

      try {
        const result = JSON.parse(text);
        if (result.status === 'success' && result.data) {
          setData(result.data);
          alert(`${data.month}월 데이터를 성공적으로 불러왔습니다.`);
        } else {
          alert(`불러오기 실패: ${result.message}\n\n(해당 월의 저장된 데이터가 없거나 구글 앱 스크립트 권한 문제일 수 있습니다.)`);
        }
      } catch (e) {
        console.error("JSON parse error:", text);
        alert("데이터를 불러오는 중 오류가 발생했습니다.\n서버 응답: " + text.substring(0, 100));
      }
    } catch (error) {
      console.error("Load docs error:", error);
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setIsLoadingDocs(false);
    }
  };

  // 구글 드라이브 저장 (Apps Script 연동)
  const saveToGoogleDrive = async () => {
    setIsSavingToDrive(true);

    try {
      // 강사별 주차 순서 변경 로직 적용 (1-2-3-4, 2-3-4-1, 3-4-1-2, 4-3-2-1)
      const modifiedData = {
        ...data,
        instructors: data.instructors.map((instructor, index) => {
          let order = [0, 1, 2, 3]; // 강사1: 1-2-3-4
          const rot = index % 4;
          if (rot === 1) order = [1, 2, 3, 0];      // 강사2: 2-3-4-1
          else if (rot === 2) order = [2, 3, 0, 1]; // 강사3: 3-4-1-2
          else if (rot === 3) order = [3, 2, 1, 0]; // 강사4: 4-3-2-1

          const reorderedWeeks = order.map(i => data.weeks[i]).filter(Boolean);
          
          // 5주차가 있는 경우 뒤에 그대로 추가
          if (data.weeks.length > 4) {
            for (let i = 4; i < data.weeks.length; i++) {
              reorderedWeeks.push(data.weeks[i]);
            }
          }

          return {
            ...instructor,
            weeks: reorderedWeeks
          };
        })
      };

      const response = await fetch(scriptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(modifiedData),
      });

      const text = await response.text();
      
      if (text.includes("App Script is running.")) {
        alert("구글 앱 스크립트가 최신 버전으로 배포되지 않았습니다.\n앱 스크립트 편집기에서 코드를 수정한 후 반드시 '새 배포(New deployment)'를 진행해주세요.");
        return;
      }

      try {
        const result = JSON.parse(text);
        if (result.status === 'success') {
          alert(`구글 드라이브 저장 성공!\n\n${result.message}`);
        } else {
          alert(`저장 실패: ${result.message}\n\n(구글 앱 스크립트 권한 문제일 수 있습니다. 앱 스크립트 편집기에서 코드를 한 번 '실행'하여 권한을 허용해주세요.)`);
        }
      } catch (e) {
        console.error("JSON parse error:", text);
        alert("저장 중 오류가 발생했습니다.\n서버 응답: " + text.substring(0, 100));
      }
    } catch (error) {
      console.error("Google Drive save error:", error);
      alert("네트워크 오류가 발생했습니다. CORS 문제이거나 앱 스크립트 URL이 잘못되었을 수 있습니다.");
    } finally {
      setIsSavingToDrive(false);
    }
  };

  // 주차별 데이터 업데이트 함수
  const updateWeek = (idx: number, field: keyof WeekData, value: string | boolean) => {
    setData(prev => {
      const newWeeks = [...prev.weeks];
      newWeeks[idx] = { ...newWeeks[idx], [field]: value };
      return { ...prev, weeks: newWeeks };
    });
  };

  // 이미지 파일 업로드 처리 함수 (Base64 변환)
  const handleImageUpload = (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateWeek(idx, 'image', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // 이미지 붙여넣기 처리 함수
  const handlePaste = (idx: number, e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
            updateWeek(idx, 'image', reader.result as string);
          };
          reader.readAsDataURL(file);
        }
        break;
      }
    }
  };

  // AI 자동 작성 함수
  const handleAIGeneration = async (idx: number) => {
    if (!ai) {
      alert("AI 기능이 설정되지 않았습니다. (API 키 누락)");
      return;
    }
    const week = data.weeks[idx];
    if (!week.image) {
      alert("먼저 교구 사진을 등록(또는 붙여넣기) 해주세요.");
      return;
    }
    
    if (week.image.includes('unsplash.com')) {
      alert("기본 예시 이미지는 AI 분석이 불가능합니다. 실제 교구 사진을 등록해주세요.");
      return;
    }

    updateWeek(idx, 'isGenerating', true);

    try {
      // 1. 사진 분석 (교구명, 계획안 목표, 기대효과)
      const mimeType = week.image.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/)?.[1] || 'image/jpeg';
      const base64Data = week.image.split(',')[1];

      if (!base64Data) {
        throw new Error("이미지 데이터가 올바르지 않습니다.");
      }

      const imageResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { inlineData: { mimeType, data: base64Data } },
            { text: `이 사진에 있는 교구(악기 또는 도구)의 이름을 알려주고, 노인 대상 음악/인지/신체 프로그램에서 이 교구를 사용할 때의 '수업 목표'와 '기대 효과'를 작성해줘.
            응답은 반드시 JSON 형식으로 작성하며, 다음 스키마를 따라야 해:
            {
              "toolName": "교구 이름 (예: 막대탬버린, 소고 등)",
              "goal": "수업 목표 (1~2문장)",
              "expectedEffect": "기대 효과 (1~2문장)"
            }` }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              toolName: { type: Type.STRING },
              goal: { type: Type.STRING },
              expectedEffect: { type: Type.STRING }
            },
            required: ["toolName", "goal", "expectedEffect"]
          }
        }
      });

      const imageResult = JSON.parse(imageResponse.text || "{}");
      
      // 2. 계획안 바탕으로 일지 내용 생성
      const planResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `다음은 노인 대상 프로그램의 계획안 내용이야.
        - 교구명: ${imageResult.toolName}
        - 계획안 목표: ${imageResult.goal}
        - 계획안 기대효과: ${imageResult.expectedEffect}
        
        이 내용을 바탕으로 실제 수업을 진행한 후 작성하는 '일지'의 내용을 작성해줘.
        1. 일지 목표: 계획안 목표를 바탕으로 작성하되, 실제 달성하고자 했던 구체적인 목표 2가지를 작성해줘. (예: 1. ~한다. 2. ~한다.)
        2. 전반적 평가(모니터링): 위 목표와 기대효과가 실제 수업에서 어떻게 나타났는지, 어르신들의 반응과 참여도, 변화 등을 포함하여 3~4문장으로 구체적으로 작성해줘.
        
        응답은 반드시 JSON 형식으로 작성하며, 다음 스키마를 따라야 해:
        {
          "journalGoal": "일지 목표 2가지 (번호를 매겨서 작성)",
          "evaluation": "전반적 평가 내용"
        }`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              journalGoal: { type: Type.STRING },
              evaluation: { type: Type.STRING }
            },
            required: ["journalGoal", "evaluation"]
          }
        }
      });

      const planResult = JSON.parse(planResponse.text || "{}");

      // 상태 업데이트 (최신 상태 기반)
      setData(prev => {
        const newWeeks = [...prev.weeks];
        newWeeks[idx] = {
          ...newWeeks[idx],
          toolName: imageResult.toolName || newWeeks[idx].toolName,
          goal: imageResult.goal || newWeeks[idx].goal,
          expectedEffect: imageResult.expectedEffect || newWeeks[idx].expectedEffect,
          journalGoal: planResult.journalGoal || newWeeks[idx].journalGoal,
          evaluation: planResult.evaluation || newWeeks[idx].evaluation,
          isGenerating: false
        };
        return { ...prev, weeks: newWeeks };
      });

    } catch (error) {
      console.error("AI Generation Error:", error);
      alert("AI 자동 작성 중 오류가 발생했습니다.");
      updateWeek(idx, 'isGenerating', false);
    }
  };

  // 인쇄하기
  const handlePrint = () => {
    window.print();
  };

  if (!isLoggedIn) {
    if (isSigningUp) {
      return <SignupPage onNavigateToLogin={() => setIsSigningUp(false)} />;
    }
    return <LoginPage onLogin={(email) => { setIsLoggedIn(true); setLoggedInEmail(email); }} onNavigateToSignup={() => setIsSigningUp(true)} />;
  }

  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      {/* 로딩 오버레이 */}
      {isSavingToDrive && (
        <div className="fixed inset-0 bg-black/50 flex flex-col items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 text-center">
            <div className="relative w-20 h-20 mb-6">
              <div className="absolute inset-0 border-4 border-yellow-100 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-yellow-600 rounded-full border-t-transparent animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center text-yellow-600">
                <CloudUpload size={28} className="animate-pulse" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">구글 드라이브에 저장 중입니다</h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              강사 4명의 계획안과 일지(총 8개)를 생성하고 있습니다.<br/>
              약 30~60초 정도 소요될 수 있습니다.
            </p>
          </div>
        </div>
      )}

      {/* 화면에만 보이는 UI 영역 (인쇄 시 숨김 처리) */}
      <div className="max-w-7xl mx-auto p-4 sm:p-8 no-print space-y-6">
        {/* 상단 헤더 및 탭 메뉴 */}
        <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-6 rounded-xl shadow-sm gap-4">
          <div className="flex items-center gap-3">
            <FileText className="text-blue-600" size={28} />
            <h1 className="text-2xl font-bold text-gray-800">교육 문서 자동화 시스템</h1>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            <button 
              onClick={() => setActiveTab('form')} 
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'form' ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            >
              데이터 입력
            </button>
            <button 
              onClick={() => setActiveTab('preview')} 
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'preview' ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            >
              미리보기
            </button>
          </div>
          <div className="flex flex-wrap gap-3 w-full sm:w-auto">
            <button 
              onClick={handlePrint}
              className="flex items-center gap-2 bg-green-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              <Printer size={20} />
              인쇄하기
            </button>
            <button 
              onClick={saveToGoogleDrive}
              disabled={isSavingToDrive}
              className="flex items-center gap-2 bg-yellow-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSavingToDrive ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <CloudUpload size={20} />
              )}
              {isSavingToDrive ? '저장 중...' : '독스 저장'}
            </button>
            <button 
              onClick={handleLoadDocs}
              disabled={isLoadingDocs}
              className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoadingDocs ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
              {isLoadingDocs ? '불러오는 중...' : '독스 불러오기'}
            </button>
          </div>
        </div>

        {/* 탭 내용 */}
        {activeTab === 'form' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* 좌측: 기본 정보 및 강사 정보 입력 */}
            <div className="space-y-8">
              <div className="bg-white p-6 rounded-xl shadow-sm space-y-6">
                <h2 className="text-lg font-semibold border-b pb-2 flex items-center gap-2">
                  <Settings size={18} /> 기본 정보
                </h2>
                
                <div className="space-y-4">
                  {/* 첫 번째 줄: 년도, 월 */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">년도 (Year)</label>
                      <input 
                        type="text" 
                        value={data.year || ''} 
                        onChange={e => {
                          const newYear = e.target.value;
                          setData(prev => {
                            const newWeeks = prev.weeks.map((week, idx) => {
                              const newDate = getWeekRange(parseInt(newYear, 10) || new Date().getFullYear(), prev.month, idx);
                              return { ...week, date: newDate || week.date };
                            });
                            return { ...prev, year: newYear, weeks: newWeeks };
                          });
                        }} 
                        className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">월 (Month)</label>
                      <input 
                        type="text" 
                        value={data.month || ''} 
                        onChange={e => {
                          const newMonth = e.target.value;
                          setData(prev => {
                            const newWeeks = prev.weeks.map((week, idx) => {
                              const newDate = getWeekRange(parseInt(prev.year, 10) || new Date().getFullYear(), newMonth, idx);
                              return { ...week, date: newDate || week.date };
                            });
                            return { ...prev, month: newMonth, weeks: newWeeks };
                          });
                        }} 
                        className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none" 
                      />
                    </div>
                  </div>

                  {/* 두 번째 줄: 과목 선택 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">과목 (Subject)</label>
                    <div className="flex items-center justify-between bg-gray-50 px-3 py-2.5 rounded-md border border-gray-300">
                      {['음악', '체조', '전래', '교구', '노래'].map(cat => (
                        <label key={cat} className="flex items-center gap-1.5 cursor-pointer shrink-0">
                          <input 
                            type="radio" 
                            name="category" 
                            value={cat} 
                            checked={data.subject === cat}
                            onChange={(e) => {
                              const newSubject = e.target.value;
                              const templates = categoryTemplates[newSubject];
                              setData(prev => ({
                                ...prev,
                                subject: newSubject,
                                planTemplateId: templates?.plan || '',
                                journalTemplateId: templates?.journal || ''
                              }));
                            }}
                            className="text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                          />
                          <span className="text-sm font-medium text-gray-700 whitespace-nowrap">{cat}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* 세 번째 줄: 공통 음악체조 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">공통 음악체조</label>
                      <input 
                        type="text" 
                        value={data.musicGymnastics || ''} 
                        onChange={e => setData({...data, musicGymnastics: e.target.value})} 
                        className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none" 
                        placeholder="예: 개나리처녀" 
                      />
                    </div>
                    {/* 빈 공간 */}
                    <div></div>
                  </div>
                </div>

                {/* 네 번째 줄: 이메일 자동 보내기 버튼 */}
                <div className="pt-4">
                  <button 
                    onClick={() => window.open(`https://janggo-center-auto-email.vercel.app?autoLoginEmail=${encodeURIComponent(loggedInEmail)}`, '_blank')}
                    className="flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors w-full shadow-sm"
                  >
                    <Mail size={20} />
                    이메일 자동 보내기
                  </button>
                </div>

                <div className="mt-6 pt-6 border-t">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">주차별 교구 이미지 (클릭/붙여넣기)</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {data.weeks.map((week, idx) => (
                      <div key={`img-${idx}`} className="group">
                        <label className="block text-xs font-medium text-gray-600 mb-1 group-focus-within:text-blue-600 transition-colors">{idx + 1}주차</label>
                        <div 
                          className="week-image-container border-2 border-dashed border-gray-300 rounded-lg p-2 text-center cursor-pointer hover:bg-gray-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all bg-white relative h-28 flex flex-col items-center justify-center"
                          onPaste={(e) => handlePaste(idx, e)}
                          onClick={() => fileInputRefs.current[idx]?.click()}
                          tabIndex={0}
                        >
                          {week.image ? (
                            <img src={week.image} alt="preview" className="max-h-full object-contain mx-auto" />
                          ) : (
                            <div className="text-gray-400 flex flex-col items-center gap-1">
                              <Upload size={16} />
                              <p className="text-[10px] leading-tight">클릭 또는<br/>Ctrl+V</p>
                            </div>
                          )}
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            ref={el => fileInputRefs.current[idx] = el}
                            onChange={(e) => handleImageUpload(idx, e)} 
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm space-y-4">
                <h2 className="text-lg font-semibold border-b pb-2 flex items-center gap-2">
                  <Users size={18} /> 강사 정보 (4명)
                </h2>
                {data.instructors.map((inst, idx) => (
                  <div key={inst.id} className="grid grid-cols-1 gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">강사 {idx + 1} 이름</label>
                        <input type="text" value={inst.name || ''} onChange={e => {
                          const newInsts = [...data.instructors];
                          newInsts[idx].name = e.target.value;
                          setData({...data, instructors: newInsts});
                        }} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">연락처 1</label>
                        <input type="text" value={inst.phone1 || ''} onChange={e => {
                          const newInsts = [...data.instructors];
                          newInsts[idx].phone1 = e.target.value;
                          setData({...data, instructors: newInsts});
                        }} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">연락처 2 (선택)</label>
                        <input type="text" value={inst.phone2 || ''} onChange={e => {
                          const newInsts = [...data.instructors];
                          newInsts[idx].phone2 = e.target.value;
                          setData({...data, instructors: newInsts});
                        }} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">연락처 3 (선택)</label>
                        <input type="text" value={inst.phone3 || ''} onChange={e => {
                          const newInsts = [...data.instructors];
                          newInsts[idx].phone3 = e.target.value;
                          setData({...data, instructors: newInsts});
                        }} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 우측: 주차별 교육 내용 입력 */}
            <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm space-y-6">
              <h2 className="text-lg font-semibold border-b pb-2 flex items-center gap-2">
                <Calendar size={18} /> 주차별 교육 내용 (4주)
              </h2>
              <div className="space-y-8">
                {data.weeks.map((week, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-5 bg-gray-50 space-y-4 shadow-sm">
                    <div className="flex justify-between items-center border-b pb-3">
                      <h3 className="font-bold text-blue-700 text-lg">{idx + 1}주차</h3>
                      <button 
                        onClick={() => handleAIGeneration(idx)}
                        disabled={week.isGenerating}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:bg-indigo-400"
                      >
                        {week.isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                        {week.isGenerating ? 'AI 작성 중...' : '사진으로 내용 자동 완성'}
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">제공일시 (일지용)</label>
                        <input type="text" value={week.date || ''} onChange={e => updateWeek(idx, 'date', e.target.value)} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">교구명</label>
                        <input type="text" value={week.toolName || ''} onChange={e => updateWeek(idx, 'toolName', e.target.value)} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">{getLabels(data.subject).singAlong}</label>
                        <input type="text" value={week.singAlong || ''} onChange={e => updateWeek(idx, 'singAlong', e.target.value)} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">{getLabels(data.subject).playingActivity}</label>
                        <input type="text" value={week.playingActivity || ''} onChange={e => updateWeek(idx, 'playingActivity', e.target.value)} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">목표</label>
                        <textarea value={week.goal || ''} onChange={e => updateWeek(idx, 'goal', e.target.value)} rows={3} className="w-full border border-gray-300 rounded-md p-2 text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">기대효과 (계획안용)</label>
                        <textarea value={week.expectedEffect || ''} onChange={e => updateWeek(idx, 'expectedEffect', e.target.value)} rows={3} className="w-full border border-gray-300 rounded-md p-2 text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">일지 목표 (자동입력)</label>
                        <textarea value={week.journalGoal || ''} onChange={e => updateWeek(idx, 'journalGoal', e.target.value)} rows={3} className="w-full border border-gray-300 rounded-md p-2 text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">전반적 평가 (일지용)</label>
                        <textarea value={week.evaluation || ''} onChange={e => updateWeek(idx, 'evaluation', e.target.value)} rows={3} className="w-full border border-gray-300 rounded-md p-2 text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : activeTab === 'preview' ? (
          <div className="bg-gray-200 p-8 rounded-xl overflow-auto flex flex-col items-center gap-8 preview-container" style={{ maxHeight: '80vh' }}>
            <div className="text-center text-gray-600 bg-white p-4 rounded-lg shadow-sm w-full max-w-2xl">
              <p className="font-bold text-lg mb-1">미리보기 화면입니다.</p>
              <p className="text-sm">실제 인쇄 시 A4 사이즈에 맞춰 여백 없이 깔끔하게 출력됩니다.</p>
              <p className="text-sm text-blue-600 mt-2">총 20장 (강사 4명 × (계획안 1장 + 일지 4장))이 인쇄됩니다.</p>
            </div>
            
            {/* 첫 번째 강사의 계획안과 1주차 일지만 미리보기로 제공 */}
            <div className="shadow-2xl bg-white transform scale-90 origin-top transition-transform hover:scale-95">
              <PlanTemplate data={data} instructor={data.instructors[0]} />
            </div>
            <div className="shadow-2xl bg-white transform scale-90 origin-top transition-transform hover:scale-95">
              <JournalTemplate data={data} instructor={data.instructors[0]} week={data.weeks[0]} />
            </div>
          </div>
        ) : null}
      </div>

      {/* 실제 인쇄 시에만 렌더링되는 영역 (총 20장) */}
      <div className="print-only">
        {data.instructors.map(instructor => (
          <React.Fragment key={instructor.id}>
            {/* 강사별 계획안 1장 */}
            <PlanTemplate data={data} instructor={instructor} />
            
            {/* 강사별 일지 4장 */}
            {data.weeks.map(week => (
              <JournalTemplate key={`${instructor.id}-${week.weekNumber}`} data={data} instructor={instructor} week={week} />
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
