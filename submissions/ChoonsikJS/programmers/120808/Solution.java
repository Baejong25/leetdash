class Solution {
    public int[] solution(int numer1, int denom1, int numer2, int denom2) {
        int numer = (denom1 * numer2)+(denom2 * numer1);
        int denom = denom1 * denom2;
        int gcd = 0;
        for (int i = 1; i <=numer && i <=denom ; i++) {
			if (numer % i == 0 &&
				denom % i == 0) gcd = i;
		}
        int[] answer = {numer/gcd, denom/gcd};
        return answer;
    }
}