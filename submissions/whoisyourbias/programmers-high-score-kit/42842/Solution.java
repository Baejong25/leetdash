class Solution {
    public int[] solution(int brown, int yellow) {
        int[] answer = new int[2];
        int sq = (int) Math.sqrt(yellow);
        
        for (int i = sq; i > 0; i--) {
            if (yellow % i == 0) {
                int w = i;
                int h = yellow / i;
                if ((w*2 + 4 + h*2) == brown) {
                    answer[0] = h + 2;
                    answer[1] = w + 2;
                    break;
                }
            }
        }
        
        return answer;
    }
}
