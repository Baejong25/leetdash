// 문자열 s의 길이 : 100,000 이하의 자연수
// 문자열 s는 '(' 또는 ')' 로만 이루어져 있습니다.
//

import java.util.Stack;

class Solution {
	boolean solution(String s) {
		boolean answer = true;

		Stack<Character> stack = new Stack<>();

		for (char c : s.toCharArray()) {
			if (c == '(') {
				stack.add(c);
			} else {
				if (stack.isEmpty())
					return false;
				else
					stack.pop();
			}
		}

		if (!stack.isEmpty())
			answer = false;

		return answer;
	}
}
