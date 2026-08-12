class Solution {
    public int[] solution(int n) {
        int len = 0;
        for (int i=1 ; i<=n ;i++) if(i%2==1) len++;
        int[] answer = new int[len];
        int start = 1;
        answer[0]=start;
        for (int i=1 ; i<len;i++) {
            start +=2;
            answer[i]=start;
        }
        return answer;
    }
}