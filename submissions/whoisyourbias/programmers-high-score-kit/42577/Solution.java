/*
phone_book의 길이는 1 이상 1,000,000 이하입니다.
각 전화번호의 길이는 1 이상 20 이하입니다.
같은 전화번호가 중복해서 들어있지 않습니다.
 * */

import java.util.Arrays;
import java.util.Comparator;

class Solution {
	public boolean solution(String[] phone_book) {
		boolean answer = true;

		MyComparator comp = new MyComparator();
		Arrays.sort(phone_book, comp);

		for (int i = 0; i < phone_book.length - 1; i++) {
			if (phone_book[i + 1].startsWith(phone_book[i]))
				return false;
		}

		return answer;
	}
}

class MyComparator implements Comparator<String> {
	@Override
	public int compare(String a, String b) {
		return a.compareTo(b);
	}
}
