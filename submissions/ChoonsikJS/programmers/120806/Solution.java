class Solution {
    public int solution(int num1, int num2) {
        float answer = -1;
        answer = (float)num1 / (float)num2;
        answer *= 1000;
        return (int)answer;
        }
}