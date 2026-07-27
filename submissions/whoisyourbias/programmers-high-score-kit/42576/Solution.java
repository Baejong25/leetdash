/*
마라톤 경기에 참여한 선수의 수는 1명 이상 100,000명 이하입니다.
completion의 길이는 participant의 길이보다 1 작습니다.
참가자의 이름은 1개 이상 20개 이하의 알파벳 소문자로 이루어져 있습니다.
참가자 중에는 동명이인이 있을 수 있습니다.
 * */

import java.util.HashMap;

class Solution {
	public String solution(String[] participant, String[] completion) {
		String answer = "";

		HashMap<String, Integer> p = new HashMap<>();

		for (String s : participant) {
			if (p.get(s) == null)
				p.put(s, 1);
			else
				p.put(s, p.get(s) + 1);
		}

		for (String c : completion) {

			if (p.get(c) == 1)
				p.remove(c);
			else
				p.put(c, p.get(c) - 1);
		}

		for (String key : p.keySet()) {
			answer = key;
		}

		return answer;
	}
}
